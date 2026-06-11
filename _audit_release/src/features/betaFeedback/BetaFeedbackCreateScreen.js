// src/features/betaFeedback/BetaFeedbackCreateScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import {
  BETA_FEEDBACK_TYPE_LABELS,
  BETA_FEEDBACK_SEVERITY_LABELS,
  BETA_FEEDBACK_LIMITS,
} from './constants';
import {
  validateFeedbackDraft,
  validateAttachmentCandidate,
} from './validation.js';
import {
  isMediaPickerEnabled,
  pickBetaFeedbackMedia,
  mapImagePickerError,
  validatePickedAsset,
} from './mediaPicker.js';
import { isUploadEnabled, createUploadService } from './uploadService.js';
import { isSubmitEnabled, createSubmitService } from './feedbackSubmitService.js';
import { db } from '../../services/firebase.js';

export default function BetaFeedbackCreateScreen() {
  const [type, setType] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenName, setScreenName] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isValidated, setIsValidated] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Check if entry is enabled
  const isEntryEnabled = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_ENTRY === '1';

  const handleValidate = () => {
    const draft = {
      userId: 'local-beta-user', // Placeholder para validação local
      type,
      severity,
      title,
      description,
      screenName,
      stepsToReproduce,
      expectedResult,
      actualResult,
      attachments,
    };

    const validationErrors = validateFeedbackDraft(draft);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      setIsValidated(true);
      Alert.alert(
        'Feedback validado localmente',
        'Envio real será habilitado em uma próxima fase.',
      );
    } else {
      setIsValidated(false);
      Alert.alert(
        'Erros de validação',
        validationErrors.map(e => e.message).join('\n'),
      );
    }
  };

  const handleAddAttachment = async () => {
    if (!isMediaPickerEnabled()) {
      Alert.alert(
        'Anexos desabilitados',
        'Seleção de mídia está desabilitada nesta fase.',
      );
      return;
    }

    if (attachments.length >= BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT) {
      Alert.alert(
        'Limite atingido',
        `Máximo de ${BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT} anexos por feedback.`,
      );
      return;
    }

    try {
      const pickedAssets = await pickBetaFeedbackMedia({ maxCount: 1 });
      
      if (pickedAssets && pickedAssets.length > 0) {
        const asset = pickedAssets[0];
        const validation = validatePickedAsset(asset);
        
        if (!validation.valid) {
          Alert.alert('Arquivo inválido', validation.error);
          return;
        }

        const newAttachment = {
          id: `local-${Date.now()}`,
          type: asset.type,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          localUri: asset.localUri,
        };

        setAttachments([...attachments, newAttachment]);
      }
    } catch (error) {
      const message = mapImagePickerError(error);
      if (!message.includes('cancelada')) {
        Alert.alert('Erro ao selecionar mídia', message);
      }
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleUploadAttachments = async () => {
    if (!isUploadEnabled()) {
      Alert.alert('Upload desabilitado', 'Upload está desabilitado nesta fase.');
      return;
    }

    if (attachments.length === 0) {
      Alert.alert('Sem anexos', 'Adicione anexos antes de fazer upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadService = createUploadService({ storage: null });
      const userId = 'local-beta-user';
      const feedbackId = `feedback-${userId}-${Date.now()}`;

      const uploadedAttachments = [];
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const progress = ((i + 1) / attachments.length) * 100;
        setUploadProgress(progress);

        try {
          const result = await uploadService.uploadAttachment({
            userId,
            feedbackId,
            attachment,
          });
          uploadedAttachments.push(result);
        } catch (error) {
          Alert.alert('Erro no upload', `Falha ao fazer upload de ${attachment.fileName}`);
          setIsUploading(false);
          return;
        }
      }

      setAttachments(uploadedAttachments);
      Alert.alert('Upload concluído', 'Todos os anexos foram enviados com sucesso.');
    } catch (error) {
      Alert.alert('Erro no upload', 'Erro ao fazer upload dos anexos.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!isSubmitEnabled()) {
      Alert.alert('Envio desabilitado', 'Envio está desabilitado nesta fase.');
      return;
    }

    const draft = {
      userId: 'local-beta-user',
      type,
      severity,
      title,
      description,
      screenName,
      stepsToReproduce,
      expectedResult,
      actualResult,
      attachments,
    };

    const validationErrors = validateFeedbackDraft(draft);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      Alert.alert('Erros de validação', validationErrors.map(e => e.message).join('\n'));
      return;
    }

    setIsSubmitting(true);

    try {
      const submitService = createSubmitService({ db, auth: null });
      const result = await submitService.submitFeedback({
        userId: 'local-beta-user',
        draft,
        attachments,
      });

      Alert.alert(
        'Feedback enviado',
        `Feedback ${result.feedbackId} enviado com sucesso.`,
      );

      // Reset form
      setType(null);
      setSeverity(null);
      setTitle('');
      setDescription('');
      setScreenName('');
      setStepsToReproduce('');
      setExpectedResult('');
      setActualResult('');
      setAttachments([]);
      setErrors([]);
      setIsValidated(false);
    } catch (error) {
      Alert.alert('Erro ao enviar', 'Erro ao enviar feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSelector = () => (
    <View style={styles.section}>
      <Text style={styles.label}>Tipo de feedback</Text>
      <View style={styles.optionsContainer}>
        {Object.entries(BETA_FEEDBACK_TYPE_LABELS).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.option,
              type === key && styles.optionSelected,
            ]}
            onPress={() => setType(key)}
          >
            <Text
              style={[
                styles.optionText,
                type === key && styles.optionTextSelected,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSeveritySelector = () => (
    <View style={styles.section}>
      <Text style={styles.label}>Severidade</Text>
      <View style={styles.optionsContainer}>
        {Object.entries(BETA_FEEDBACK_SEVERITY_LABELS).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.option,
              severity === key && styles.optionSelected,
            ]}
            onPress={() => setSeverity(key)}
          >
            <Text
              style={[
                styles.optionText,
                severity === key && styles.optionTextSelected,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAttachmentsPlaceholder = () => {
    const isEnabled = isMediaPickerEnabled();
    const canAddMore = attachments.length < BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT;

    return (
      <View style={styles.section}>
        <Text style={styles.label}>
          Anexos ({attachments.length}/{BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT})
        </Text>

        {!isEnabled && (
          <View style={styles.attachmentsPlaceholder}>
            <Text style={styles.placeholderText}>
              Anexos de imagem/vídeo estão desabilitados nesta fase.
            </Text>
            <Text style={styles.placeholderSubtext}>
              Até {BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT} anexos
            </Text>
            <Text style={styles.placeholderSubtext}>
              Imagem até {BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB
            </Text>
            <Text style={styles.placeholderSubtext}>
              Vídeo até {BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB
            </Text>
          </View>
        )}

        {isEnabled && canAddMore && (
          <TouchableOpacity
            style={styles.addAttachmentButton}
            onPress={handleAddAttachment}
          >
            <Text style={styles.addAttachmentButtonText}>
              + Adicionar anexo
            </Text>
          </TouchableOpacity>
        )}

        {attachments.length > 0 && (
          <View style={styles.attachmentsList}>
            {attachments.map((attachment) => (
              <View key={attachment.id} style={styles.attachmentItem}>
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentFileName}>
                    {attachment.fileName}
                  </Text>
                  <Text style={styles.attachmentDetails}>
                    {attachment.type === 'image' ? '📷' : '🎥'} • {(attachment.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeAttachmentButton}
                  onPress={() => handleRemoveAttachment(attachment.id)}
                >
                  <Text style={styles.removeAttachmentButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Feedback Beta</Text>
      <Text style={styles.subtitle}>
        Reporte bugs, sugestões ou melhorias para ajudar a evoluir o app
      </Text>

      {renderTypeSelector()}
      {renderSeveritySelector()}

      <View style={styles.section}>
        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Descreva o problema em uma frase"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Descrição *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Explique o problema em detalhes"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tela/fluxo onde aconteceu</Text>
        <TextInput
          style={styles.input}
          value={screenName}
          onChangeText={setScreenName}
          placeholder="Ex: Tela de treino, Perfil, etc."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Passos para reproduzir</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={stepsToReproduce}
          onChangeText={setStepsToReproduce}
          placeholder="Liste os passos para reproduzir o problema"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Resultado esperado</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={expectedResult}
          onChangeText={setExpectedResult}
          placeholder="O que você esperava que acontecesse"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Resultado obtido</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={actualResult}
          onChangeText={setActualResult}
          placeholder="O que realmente aconteceu"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={2}
        />
      </View>

      {renderAttachmentsPlaceholder()}

      {isUploadEnabled() && attachments.length > 0 && (
        <TouchableOpacity
          style={[styles.button, isUploading && styles.buttonDisabled]}
          onPress={handleUploadAttachments}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>
            {isUploading ? `Fazendo upload... ${Math.round(uploadProgress)}%` : 'Fazer upload dos anexos'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.button} onPress={handleValidate}>
        <Text style={styles.buttonText}>Validar feedback</Text>
      </TouchableOpacity>

      {isSubmitEnabled() && isValidated && (
        <TouchableOpacity
          style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmitFeedback}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Enviando...' : 'Enviar feedback'}
          </Text>
        </TouchableOpacity>
      )}

      {isValidated && (
        <View style={styles.successMessage}>
          <Text style={styles.successText}>
            ✓ Feedback validado localmente
          </Text>
          <Text style={styles.successSubtext}>
            Envio real será habilitado em uma próxima fase
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  attachmentsPlaceholder: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  placeholderSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  successMessage: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  successText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  successSubtext: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  addAttachmentButton: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  addAttachmentButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  attachmentsList: {
    marginTop: spacing.md,
  },
  attachmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentFileName: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  attachmentDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  removeAttachmentButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removeAttachmentButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 16,
  },
});
