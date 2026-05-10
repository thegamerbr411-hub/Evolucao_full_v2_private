# BUGS REMAINING FINAL

## Critico

- Nenhum bug critico reproduzido na rodada principal de 2026-05-08.

## Alto

- Fluxo de videos nao validado ponta a ponta na build testada.
  - Impacto: bloqueia a afirmacao de que videos/player/fullscreen estao funcionando em producao real.
  - Evidencia: summary da rodada principal informa que a entrada explicita de videos nao foi localizada; rechecagem focada em recovery_audit/final_device/video_check_20260508_051305 tambem nao encontrou os controles esperados.
  - Necessario: expor de forma navegavel o acesso ao detalhe do exercicio com video ou mapear uma rota/CTA estavel de UI para validacao real.

- Logout da sessao principal nao encontrado de forma explicita na UI testada.
  - Impacto: impede validar o ciclo funcional completo de sessao pela interface do usuario.
  - Evidencia: summary da rodada principal registra logout_action_not_found.
  - Necessario: adicionar/explicitar CTA de logout para sessao email/senha e validar limpeza de estado + retorno a rota protegida.

## Medio

- Warnings de deprecacao em runtime para expo-av.
  - Impacto: nao derrubou o app nesta rodada, mas aumenta risco tecnico e afeta manutencao do player de video.
  - Evidencia: logs ReactNativeJS/device indicaram aviso ligado a expo-av.
  - Necessario: migrar o player para a alternativa suportada pelo stack atual ou revisar a dependencia para a versao recomendada.

- Warning de deprecacao para InteractionManager.
  - Impacto: sem falha funcional imediata observada, mas sinaliza codigo legado com risco de regressao futura.
  - Evidencia: warning em logs durante a rodada real.
  - Necessario: revisar os pontos que usam essa API e migrar para padrao suportado.

## Baixo

- Logs principais em UTF-16 dificultam triagem rapida fora do terminal.
  - Impacto: operacional, nao funcional.
  - Evidencia: leitura direta de recovery_audit/final_device/logs/metro_live.log e partes do device log exigiu tratamento de codificacao.
  - Necessario: normalizar export de logs em UTF-8 nos scripts de coleta.

## Resumo de risco

- Auth principal: risco baixo apos rodada real.
- Navegacao base: risco baixo apos rodada real.
- Treinos: risco baixo apos rodada real.
- Admin basico: risco medio, porque o CRUD exercitado foi curto e focado em happy path.
- Videos: risco alto, porque a cobertura real nao foi concluida.
- Gestao de sessao/logout: risco alto, porque a saida da sessao principal nao foi exposta/validada via UI.