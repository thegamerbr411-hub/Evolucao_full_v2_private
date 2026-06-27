import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AppCard, ScreenHeader } from '../components/ui';
import { colors, spacing, radius } from '../theme';
import { getExerciseByName } from '../data/exercises.js';
import { ExerciseMediaFallback } from '../components/exercise/ExerciseMediaFallback';
import {
  EXERCISE_INSTRUCTIONS_COMING_SOON,
  isValidHttpUrl,
  resolveExerciseMedia,
} from '../utils/exerciseMedia';
import { trackAppError } from '../utils/analytics';
import { logTaggedError, logTaggedEvent } from '../utils/runtimeLogger';
import { QA_ELEMENTS, QA_SCREENS, qaAliasProps, qaProps } from '../qa/selectorRegistry';
import { setQaPlayerState } from '../qa/qaAutomationState';
import { formatExerciseName } from '../utils/displayText';

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'historico', label: 'Historico' },
  { key: 'instrucoes', label: 'Instrucoes' },
];

function formatLabel(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toSafeList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function buildYoutubeSearchUrl(exerciseName = '') {
  const query = encodeURIComponent(`${String(exerciseName || '').trim()} exercicio execucao correta`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

function safeTrackAppError(error, context) {
  try {
    trackAppError(error, context);
  } catch {
    // Nunca deixa erro de telemetria derrubar a tela.
  }
}

class ExerciseDetailErrorBoundary extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    setQaPlayerState({
      active: false,
      loading: false,
      fullscreen: false,
      exerciseName: null,
    });
    safeTrackAppError(error || new Error('exercise_detail_render_failed'), {
      screen: 'ExerciseDetailScreen',
      action: 'render',
      context: {
        componentStack: errorInfo?.componentStack || 'unknown',
      },
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const navigation = this.props.navigation;
    const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

    return (
      <ScrollView {...qaAliasProps(QA_SCREENS.exerciseDetail, 'screen-exercise-detail-fallback')} contentContainerStyle={styles.container}>
        <ScreenHeader title="Detalhe do exercício" subtitle="Modo seguro ativado para manter a navegação." onBack={() => navigation.goBack()} />
        <AppCard>
          <Text style={styles.sectionTitle}>Tela recuperada</Text>
          <Text style={styles.bodyText}>
            Encontramos uma instabilidade inesperada e aplicamos fallback automático. Você pode voltar sem perder a sessão.
          </Text>
        </AppCard>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (canGoBack) {
              navigation.goBack();
              return;
            }
            if (typeof navigation?.navigate === 'function') {
              navigation.navigate('Home');
            }
          }}
        >
          <Text style={styles.backButtonText}>Voltar com seguranca</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
}

function ExerciseDetailContent({ route, navigation }) {
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState('resumo');
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoRetryKey, setVideoRetryKey] = useState(0);
  const videoRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bufferingRef = useRef(false);
  const input = route?.params?.exercise || null;

  const exercise = useMemo(() => {
    if (input?.name) {
      return getExerciseByName(input.name) || input;
    }
    if (typeof input === 'string') {
      return getExerciseByName(input);
    }
    return null;
  }, [input]);

  const safeExercise = exercise && typeof exercise === 'object' ? exercise : {};

  const name = formatExerciseName(safeExercise?.name || 'Exercício indisponível');
  const musclePrimary = toSafeList(
    safeExercise?.primaryMuscle
      ? [safeExercise.primaryMuscle]
      : safeExercise?.musclePrimary
  );
  const muscleSecondary = toSafeList(
    safeExercise?.secondaryMuscles || safeExercise?.muscleSecondary
  );
  const instructions = toSafeList(safeExercise?.instructions);
  const tips = toSafeList(safeExercise?.tips);
  const commonMistakes = toSafeList(safeExercise?.commonMistakes);
  const history = toSafeList(safeExercise?.history);
  const metadata = safeExercise?.metadata && typeof safeExercise.metadata === 'object' ? safeExercise.metadata : {};
  const metadataEntries = Object.entries(metadata || {}).filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
  const media = useMemo(() => resolveExerciseMedia(safeExercise), [safeExercise]);
  const directVideoUrl = media.hasRealVideo ? media.videoUrl : '';
  const thumbnailUrl = media.hasRealThumbnail ? media.thumbnailUrl : '';
  const canRenderVideo = Boolean(directVideoUrl) && !videoFailed && videoEnabled;
  const canRenderThumbnail = Boolean(thumbnailUrl);
  const showLocalMediaFallback = media.isPlaceholder || media.showVideoComingSoon;
  const hasExerciseData = Boolean(
    safeExercise?.name ||
    musclePrimary.length ||
    muscleSecondary.length ||
    instructions.length ||
    tips.length ||
    commonMistakes.length ||
    history.length ||
    metadataEntries.length ||
    canRenderVideo ||
    canRenderThumbnail
  );

  const handleVideoError = (error) => {
    setVideoFailed(true);
    setVideoLoading(false);
    setQaPlayerState({
      active: false,
      loading: false,
      fullscreen: false,
      exerciseName: name,
    });
    logTaggedError('VIDEO', error || new Error('exercise_video_failed'), {
      action: 'video_render',
      exerciseName: name,
      videoUrl: directVideoUrl || videoUrl,
    });
    safeTrackAppError(error || new Error('exercise_video_failed'), {
      screen: 'ExerciseDetailScreen',
      action: 'video_render',
      context: { exerciseName: name, videoUrl: directVideoUrl || videoUrl },
    });
  };

  const unloadPlayer = useCallback(async (reason = 'manual_cleanup') => {
    const player = videoRef.current;
    if (!player) {
      return;
    }

    try {
      await player.pauseAsync?.();
      await player.unloadAsync?.();
      setQaPlayerState({
        active: false,
        loading: false,
        fullscreen: false,
        exerciseName: name,
      });
      logTaggedEvent('PLAYER', 'unload', {
        reason,
        exerciseName: name,
      });
    } catch (error) {
      logTaggedError('PLAYER', error, {
        action: 'unload',
        reason,
        exerciseName: name,
      });
    } finally {
      bufferingRef.current = false;
      setVideoLoading(false);
      setVideoEnabled(false);
      setQaPlayerState({
        active: false,
        loading: false,
        fullscreen: false,
        exerciseName: name,
      });
    }
  }, [name]);

  useEffect(() => {
    if (showLocalMediaFallback && instructions.length) {
      setActiveTab('instrucoes');
    }
  }, [instructions.length, showLocalMediaFallback]);

  useEffect(() => {
    logTaggedEvent('VIDEO', 'screen_ready', {
      exerciseName: name,
      hasDirectVideo: Boolean(directVideoUrl),
      hasThumbnail: canRenderThumbnail,
      isPlaceholderMedia: showLocalMediaFallback,
    });
    setQaPlayerState({
      active: false,
      loading: false,
      fullscreen: false,
      exerciseName: name,
    });

    return () => {
      unloadPlayer('screen_unmount');
    };
  }, [canRenderThumbnail, directVideoUrl, name, unloadPlayer]);

  useEffect(() => {
    setVideoFailed(false);
    setVideoLoading(false);
    setVideoEnabled(false);
    bufferingRef.current = false;
    setQaPlayerState({
      active: false,
      loading: false,
      fullscreen: false,
      exerciseName: name,
    });
  }, [directVideoUrl, name]);

  useEffect(() => {
    if (!isFocused && videoEnabled) {
      unloadPlayer('screen_blur');
    }
  }, [isFocused, unloadPlayer, videoEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      logTaggedEvent('VIDEO', 'app_state_change', {
        exerciseName: name,
        previousState,
        nextState,
      });

      const wentToBackground = previousState === 'active' && (nextState === 'inactive' || nextState === 'background');
      if (wentToBackground && videoEnabled) {
        unloadPlayer(`app_${nextState}`);
      }
    });

    return () => subscription?.remove?.();
  }, [name, unloadPlayer, videoEnabled]);

  return (
    <ScrollView {...qaAliasProps(QA_SCREENS.exerciseDetail, 'screen-exercise-detail')} contentContainerStyle={styles.container}>
      <ScreenHeader title="Detalhe do exercicio" subtitle="Guia visual premium para executar melhor e com seguranca." onBack={() => navigation.goBack()} />

      <AppCard>
        <View style={styles.videoWrap}>
          {showLocalMediaFallback ? (
            <ExerciseMediaFallback
              exercise={safeExercise}
              testID="exercise-detail-media-fallback"
            />
          ) : null}
          {!showLocalMediaFallback && canRenderVideo ? (
            <Video
              ref={videoRef}
              {...qaProps(QA_ELEMENTS.playerInternal)}
              key={`video-${videoRetryKey}`}
              source={{ uri: directVideoUrl }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={false}
              onLoadStart={() => {
                setVideoLoading(true);
                setQaPlayerState({
                  active: true,
                  loading: true,
                  fullscreen: false,
                  exerciseName: name,
                });
                logTaggedEvent('VIDEO', 'load_start', {
                  exerciseName: name,
                  videoUrl: directVideoUrl,
                });
              }}
              onLoad={(status) => {
                setVideoLoading(false);
                setQaPlayerState({
                  active: true,
                  loading: false,
                  fullscreen: false,
                  exerciseName: name,
                });
                logTaggedEvent('VIDEO', 'loaded', {
                  exerciseName: name,
                  durationMillis: Number(status?.durationMillis || 0),
                });
              }}
              onPlaybackStatusUpdate={(status) => {
                if (!status || !status.isLoaded) {
                  return;
                }

                const isBuffering = Boolean(status.isBuffering);
                if (bufferingRef.current !== isBuffering) {
                  bufferingRef.current = isBuffering;
                  logTaggedEvent('PLAYER', isBuffering ? 'buffering_start' : 'buffering_end', {
                    exerciseName: name,
                    positionMillis: Number(status.positionMillis || 0),
                  });
                }
              }}
              onFullscreenUpdate={(status) => {
                const fullscreenStatus = Number(status?.fullscreenUpdate || 0);
                const isFullscreen = fullscreenStatus === 1 || fullscreenStatus === 3;
                setQaPlayerState({
                  active: true,
                  loading: false,
                  fullscreen: isFullscreen,
                  exerciseName: name,
                });
                logTaggedEvent('PLAYER', 'fullscreen_update', {
                  exerciseName: name,
                  fullscreenStatus,
                });
              }}
              onError={handleVideoError}
            />
          ) : !showLocalMediaFallback && directVideoUrl && !videoEnabled ? (
            <View style={styles.videoFallback}>
              <Ionicons name="play-circle-outline" size={34} color={colors.textSecondary} />
              <Text style={styles.videoFallbackText}>Video pronto</Text>
              <Text style={styles.videoFallbackSubtext}>Use abertura externa (mais estável) ou player interno (beta).</Text>
              <TouchableOpacity
                {...qaAliasProps(QA_ELEMENTS.btnOpenVideoExternal, 'btn-open-video-external')}
                style={styles.retryVideoButton}
                onPress={async () => {
                  try {
                    logTaggedEvent('VIDEO', 'external_open', {
                      exerciseName: name,
                      videoUrl: buildYoutubeSearchUrl(name),
                    });
                    await WebBrowser.openBrowserAsync(buildYoutubeSearchUrl(name));
                  } catch (error) {
                    safeTrackAppError(error || new Error('exercise_video_external_open_failed'), {
                      screen: 'ExerciseDetailScreen',
                      action: 'video_external_open',
                      context: { exerciseName: name, videoUrl: buildYoutubeSearchUrl(name) },
                    });
                  }
                }}
              >
                <Text style={styles.retryVideoButtonText}>Abrir video (estável)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...qaAliasProps(QA_ELEMENTS.btnEnablePlayer, 'btn-enable-player')}
                style={styles.retryVideoButton}
                onPress={() => {
                  setVideoFailed(false);
                  setVideoLoading(true);
                  setVideoEnabled(true);
                  setVideoRetryKey((prev) => prev + 1);
                  setQaPlayerState({
                    active: true,
                    loading: true,
                    fullscreen: false,
                    exerciseName: name,
                  });
                  logTaggedEvent('PLAYER', 'internal_player_enabled', {
                    exerciseName: name,
                    videoUrl: directVideoUrl,
                  });
                }}
              >
                <Text style={styles.retryVideoButtonText}>Tentar player interno (beta)</Text>
              </TouchableOpacity>
            </View>
          ) : !showLocalMediaFallback && canRenderThumbnail ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.video} resizeMode="cover" />
          ) : null}
          {videoLoading ? (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.textPrimary} />
              <Text style={styles.videoLoadingText}>Carregando video...</Text>
            </View>
          ) : null}
        </View>

        {canRenderVideo ? (
          <View style={styles.playerActionsRow}>
            <TouchableOpacity
              {...qaAliasProps(QA_ELEMENTS.btnPlayerFullscreen, 'btn-video-fullscreen')}
              style={styles.retryVideoButton}
              onPress={async () => {
                try {
                  await videoRef.current?.presentFullscreenPlayer?.();
                  logTaggedEvent('PLAYER', 'fullscreen_requested', {
                    exerciseName: name,
                  });
                } catch (error) {
                  logTaggedError('PLAYER', error, {
                    action: 'present_fullscreen',
                    exerciseName: name,
                  });
                }
              }}
            >
              <Text style={styles.retryVideoButtonText}>Abrir em tela cheia</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...qaAliasProps(QA_ELEMENTS.btnPlayerClose, 'btn-video-close-player')}
              style={styles.retryVideoButton}
              onPress={() => {
                unloadPlayer('manual_close');
              }}
            >
              <Text style={styles.retryVideoButtonText}>Fechar player</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.exerciseName}>{name}</Text>
        <Text style={styles.metaLine}>
          {formatLabel(safeExercise?.equipment || 'equipamento livre')} · {formatLabel(safeExercise?.difficulty || 'iniciante')} · {formatLabel(safeExercise?.objective || 'hipertrofia')}
        </Text>

        {!hasExerciseData ? (
          <Text style={styles.emptyStateText}>Os dados completos deste exercicio nao estao disponiveis agora, mas a tela continua segura e navegavel.</Text>
        ) : null}

        <View style={styles.tagsRow}>
          {musclePrimary.map((item) => (
            <View key={`primary-${item}`} style={styles.primaryTag}>
              <Text style={styles.primaryTagText}>{formatLabel(item)}</Text>
            </View>
          ))}
          {muscleSecondary.map((item) => (
            <View key={`secondary-${item}`} style={styles.secondaryTag}>
              <Text style={styles.secondaryTagText}>{formatLabel(item)}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              testID={`tab-exercise-${tab.key}`}
              style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'resumo' ? (
          <View>
            <Text style={styles.sectionTitle}>Execucao em foco</Text>
            <Text style={styles.bodyText}>
              Priorize controle, amplitude segura e repeticoes com boa tecnica. Este bloco te ajuda a manter padrao de execucao em todos os treinos.
            </Text>
            {tips.length ? <Text style={styles.sectionTitle}>Dicas rapidas</Text> : null}
            {tips.map((tip) => (
              <Text key={tip} style={styles.bulletText}>• {tip}</Text>
            ))}
            {commonMistakes.length ? <Text style={styles.sectionTitle}>Erros comuns</Text> : null}
            {commonMistakes.map((mistake) => (
              <Text key={mistake} style={styles.bulletText}>• {mistake}</Text>
            ))}
          </View>
        ) : null}

        {activeTab === 'historico' ? (
          <View>
            <Text style={styles.sectionTitle}>Historico do exercicio</Text>
            {history.length ? (
              history.map((entry, index) => (
                <Text key={`${index}-${entry}`} style={styles.bulletText}>• {entry}</Text>
              ))
            ) : (
              <Text style={styles.bodyText}>Sem historico disponivel no momento.</Text>
            )}
          </View>
        ) : null}

        {activeTab === 'instrucoes' ? (
          <View>
            <Text style={styles.sectionTitle}>Passo a passo</Text>
            {instructions.length ? (
              instructions.map((step, index) => (
                <Text key={`${index}-${step}`} style={styles.bulletText}>{index + 1}. {step}</Text>
              ))
            ) : (
              <Text style={styles.bodyText}>{EXERCISE_INSTRUCTIONS_COMING_SOON}</Text>
            )}
            <Text style={styles.sectionTitle}>Informacoes adicionais</Text>
            {metadataEntries.length ? (
              metadataEntries.map(([key, value]) => (
                <Text key={`${key}-${value}`} style={styles.bulletText}>• {formatLabel(key)}: {String(value)}</Text>
              ))
            ) : (
              <Text style={styles.bodyText}>Informacoes complementares em breve.</Text>
            )}
          </View>
        ) : null}
      </AppCard>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Voltar</Text>
      </TouchableOpacity>
      <View {...qaProps(QA_ELEMENTS.playerStateAnchor)} style={{ width: 1, height: 1 }} />
    </ScrollView>
  );
}

export default function ExerciseDetailScreen({ route, navigation }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ExerciseDetailErrorBoundary navigation={navigation}>
        <ExerciseDetailContent route={route} navigation={navigation} />
      </ExerciseDetailErrorBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  videoWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  video: {
    width: '100%',
    height: 210,
  },
  videoFallback: {
    width: '100%',
    height: 210,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoLoadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoLoadingText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  videoFallbackText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  videoFallbackSubtext: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 220,
  },
  videoComingSoonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  retryVideoButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryVideoButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  metaLine: {
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  primaryTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.secondaryMuted,
  },
  primaryTagText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryTagText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  tabButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  tabText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.primary,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  bulletText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  backButton: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.textInverse,
    fontWeight: '900',
  },
});
