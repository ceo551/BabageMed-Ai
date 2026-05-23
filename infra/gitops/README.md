# GitOps deployment — ArgoCD or Flux

Two thin wrappers around the same Helm chart in `../helm/babagemed`. Pick one.

## ArgoCD

```bash
# 1. Install ArgoCD itself (skip if already running)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. Apply the AppProject + Application (edit repoURL/host/registry first)
kubectl apply -f infra/gitops/argocd/project.yaml
kubectl apply -f infra/gitops/argocd/application.yaml

# Or, for multi-env (staging + GKE/AKS/EKS prods):
kubectl apply -f infra/gitops/argocd/applicationset.yaml
```

ArgoCD reconciles on every git push. The `automated: { prune: true, selfHeal: true }` policy means any out-of-band `kubectl edit` is reverted to git. Disable selfHeal during deliberate manual debugging.

## Flux

```bash
# 1. Install Flux v2 (skip if already running)
flux install

# 2. Apply the GitRepository + HelmRelease
kubectl create namespace babagemed
kubectl apply -k infra/gitops/flux/
```

Flux watches `infra/helm/babagemed/` and re-runs `helm upgrade --install` on every change to the chart or its values. Edit `helmrelease.yaml` to pick a cloud overlay or to point `chart.spec.chart` at a packaged version.

## Secret handling — do NOT commit raw secrets

Both ArgoCD and Flux assume secrets are managed out-of-band:

- **Sealed Secrets** (`bitnami-labs/sealed-secrets`) — encrypt locally with `kubeseal`, commit the SealedSecret manifest. The in-cluster controller decrypts.
- **External Secrets Operator** — pull from GCP Secret Manager / AWS Secrets Manager / Azure Key Vault / HashiCorp Vault on-demand.
- **SOPS + kustomize/Flux integration** — `flux create kustomization … --decryption-provider=sops`.

Then set `secrets.existingSecret: babagemed-env` in your `values.yaml` overlay and the chart skips creating its own.

## Image promotion

- **ArgoCD Image Updater** — watches your registry and bumps `image.tag` automatically on new pushes.
- **Flux Image Automation** — `ImageRepository` + `ImagePolicy` + `ImageUpdateAutomation` do the same.

Both let you commit-back a tag change so the deployment history lives in git.
