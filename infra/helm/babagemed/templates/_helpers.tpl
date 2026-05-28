{{- define "babagemed.fullname" -}}
{{- printf "%s-%s" .Release.Name "babagemed" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "babagemed.labels" -}}
app.kubernetes.io/name: babagemed
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "babagemed.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "babagemed.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Database URL: external if set, else compose internal from postgres values. */}}
{{- define "babagemed.databaseUrl" -}}
{{- if and (not .Values.postgres.internal) .Values.postgres.externalUrl -}}
{{ .Values.postgres.externalUrl }}
{{- else -}}
postgres://{{ .Values.secrets.postgresUser }}:{{ .Values.secrets.postgresPassword }}@{{ .Release.Name }}-postgres:5432/{{ .Values.secrets.postgresDb }}?sslmode=disable
{{- end -}}
{{- end -}}

{{/* Image reference for backend/frontend/mcp. */}}
{{- define "babagemed.image" -}}
{{- $registry := .registry -}}
{{- $name := .name -}}
{{- $tag := .tag -}}
{{- printf "%s/%s:%s" $registry $name $tag -}}
{{- end -}}

{{/* Effective ingress class + annotations based on cloud target. */}}
{{- define "babagemed.ingressClass" -}}
{{- if .Values.ingress.className -}}
{{ .Values.ingress.className }}
{{- else if eq .Values.cloud "gke" -}}
gce
{{- else if eq .Values.cloud "eks" -}}
alb
{{- else if eq .Values.cloud "aks" -}}
nginx
{{- else -}}
nginx
{{- end -}}
{{- end -}}

{{- define "babagemed.ingressAnnotations" -}}
{{- if .Values.ingress.annotations -}}
{{ toYaml .Values.ingress.annotations }}
{{- else if eq .Values.cloud "gke" -}}
kubernetes.io/ingress.class: gce
{{ if .Values.ingress.tls.issuer }}cert-manager.io/cluster-issuer: {{ .Values.ingress.tls.issuer }}{{ end }}
{{- else if eq .Values.cloud "eks" -}}
kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/scheme: internet-facing
alb.ingress.kubernetes.io/target-type: ip
alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
{{- else -}}
kubernetes.io/ingress.class: nginx
{{ if .Values.ingress.tls.issuer }}cert-manager.io/cluster-issuer: {{ .Values.ingress.tls.issuer }}{{ end }}
nginx.ingress.kubernetes.io/proxy-body-size: "20m"
# Disable nginx response buffering so the SSE stream from /api/chat/stream
# reaches the browser token-by-token instead of being held until the body
# closes. The backend also emits X-Accel-Buffering: no on the stream itself
# (per-response), but this annotation makes the behaviour the default for
# the whole ingress so we don't have to chase per-path nginx rules.
# Longer read timeout because a long Claude/Gemini answer can run over a
# minute and the default 60s would 504 mid-stream.
nginx.ingress.kubernetes.io/proxy-buffering: "off"
nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
# Force HTTPS even if cert-manager hasn't issued yet — nginx defaults
# to 308-redirecting only when a TLS cert is present, which is the
# wrong-failsafe direction. ssl-redirect: true ensures the redirect
# is unconditional once TLS is configured at the ingress.
nginx.ingress.kubernetes.io/ssl-redirect: "true"
nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
# Belt-and-braces L7 rate limiting. The backend already does
# per-IP token buckets, but the ingress layer stops a flood before
# it ever reaches a backend goroutine. limit-rpm is per source IP.
# These numbers are generous for a real user (a chat send +
# /tools listing burst); a script doing 1k r/s hits 429 here.
nginx.ingress.kubernetes.io/limit-rpm: "600"
nginx.ingress.kubernetes.io/limit-connections: "30"
{{- end -}}
{{- end -}}

{{/* Resolve the MCP list. preset=custom uses mcps.enabled directly. */}}
{{- define "babagemed.mcpList" -}}
{{- if eq .Values.mcps.preset "all" -}}
{{ .Files.Get "mcps-all.txt" }}
{{- else if eq .Values.mcps.preset "default" -}}
{{/*
  Default preset — the marquee subset that's safe to deploy on a small
  cluster. Every id MUST exist in scripts/mcps.manifest.json (and
  therefore in mcps-index.json) or the chart silently skips it. The
  previous default list referenced 25+ deleted IDs and rendered only a
  handful of Deployments. Keep this list small and authoritative; for
  the full catalog use preset=all.
*/}}
pubmed mayoclinic who cdc nci clinicaltrials medlineplus cochrane fda ncbi nejm bmj jamanetwork frontiers gmail gcalendar gdrive github slack notion linkedin huggingface
{{- else -}}
{{ join " " .Values.mcps.enabled }}
{{- end -}}
{{- end -}}
