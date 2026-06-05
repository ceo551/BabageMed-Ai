{{- define "pervagans.fullname" -}}
{{- printf "%s-%s" .Release.Name "pervagans" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pervagans.labels" -}}
app.kubernetes.io/name: pervagans
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "pervagans.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "pervagans.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Database URL: external if set, else compose internal from postgres values.
     sslmode comes from postgres.internalSslMode — defaults to disable for the
     bundled StatefulSet (which doesn't ship a server cert). Operators running
     in clusters WITHOUT NetworkPolicy enforcement should override to require
     so SQL traffic isn't cleartext across nodes. With templates/networkpolicy
     .yaml enabled the backend↔postgres path is already pod-isolated and
     disable is acceptable. */}}
{{- define "pervagans.databaseUrl" -}}
{{- if and (not .Values.postgres.internal) .Values.postgres.externalUrl -}}
{{ .Values.postgres.externalUrl }}
{{- else -}}
postgres://{{ .Values.secrets.postgresUser }}:{{ .Values.secrets.postgresPassword }}@{{ .Release.Name }}-postgres:5432/{{ .Values.secrets.postgresDb }}?sslmode={{ .Values.postgres.internalSslMode | default "disable" }}
{{- end -}}
{{- end -}}

{{/* Image reference for backend/frontend/mcp. */}}
{{- define "pervagans.image" -}}
{{- $registry := .registry -}}
{{- $name := .name -}}
{{- $tag := .tag -}}
{{- printf "%s/%s:%s" $registry $name $tag -}}
{{- end -}}

{{/* Effective ingress class + annotations based on cloud target. */}}
{{- define "pervagans.ingressClass" -}}
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

{{- define "pervagans.ingressAnnotations" -}}
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
# Security headers for static assets (the backend handler adds these
# per-response for API traffic via main.go's CORP layer, but
# ingress-served Next.js bundles + public/ assets need them at the
# edge). HSTS gets the 6-month max-age + preload list eligibility;
# X-Frame-Options blocks clickjacking; X-Content-Type-Options stops
# IE/Edge from sniffing MIME types; Referrer-Policy strips cross-
# origin referrers so /reset-password?token=… can't leak via
# Referer; Permissions-Policy locks down sensors/payment APIs we
# don't use.
nginx.ingress.kubernetes.io/configuration-snippet: |
  more_set_headers "Strict-Transport-Security: max-age=15552000; includeSubDomains; preload";
  more_set_headers "X-Frame-Options: DENY";
  more_set_headers "X-Content-Type-Options: nosniff";
  more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
  more_set_headers "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)";
{{- end -}}
{{- end -}}

{{/* Single source of truth for the generated Redis password.

     secret.yaml (pervagans-env) and secret-mcp.yaml (pervagans-env-mcp) BOTH
     need REDIS_PASSWORD: the redis server starts with --requirepass that
     value and the backend reads it from -env, while all 262 MCPs read it
     from -mcp. Previously each template independently `lookup`-ed the env
     Secret and, on a FRESH install (neither Secret exists yet), fell through
     to its own `randAlphaNum 32` — producing TWO DIFFERENT passwords, so
     every MCP's Redis AUTH failed.

     This helper makes both render the SAME value:
       1. reuse the existing pervagans-env value on upgrade (lookup), else
       2. generate once and cache it on the shared render context (.Values)
          so the second template invocation in the same `helm` pass reads
          the cached value instead of generating a fresh one. */}}
{{- define "pervagans.redisPassword" -}}
{{- $name := .Values.mcps.envFromSecret | default "pervagans-env" -}}
{{- $existing := lookup "v1" "Secret" .Release.Namespace $name -}}
{{- if and $existing (index $existing.data "REDIS_PASSWORD") -}}
{{- index $existing.data "REDIS_PASSWORD" | b64dec -}}
{{- else -}}
{{- if not (hasKey .Values "__redisPasswordCache") -}}
{{- $_ := set .Values "__redisPasswordCache" (randAlphaNum 32) -}}
{{- end -}}
{{- index .Values "__redisPasswordCache" -}}
{{- end -}}
{{- end -}}

