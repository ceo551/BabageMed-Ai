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
{{- end -}}
{{- end -}}

{{/* Resolve the MCP list. preset=custom uses mcps.enabled directly. */}}
{{- define "babagemed.mcpList" -}}
{{- if eq .Values.mcps.preset "all" -}}
{{ .Files.Get "mcps-all.txt" }}
{{- else if eq .Values.mcps.preset "default" -}}
pubmed icd10 mayoclinic clevelandclinic who cdc rsna nci npi clinicaltrials chembl medrxiv biorxiv dailymed medlineplus drugscom rxlist nhs healthline nejm bmj pubchem endotext ncbi fda kdigo kidneyfoundation nimh frontiers ourworldindata cms cochrane wikem eyewiki orthoinfo orthobullets statpearls emcrit geekymedics teachmeanatomy openanesthesia gold gina dermnet librepathology nice
{{- else -}}
{{ join " " .Values.mcps.enabled }}
{{- end -}}
{{- end -}}
