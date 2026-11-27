# Persistent Switch on Azure AKS

A web page with one on/off switch whose value is stored in PostgreSQL, so it survives the restart of any pod. The page also shows the live health of both database pods. This README covers how to deploy, update, check and troubleshoot it on AKS.

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Prerequisites](#prerequisites)
- [First deployment](#first-deployment)
- [Releasing an update](#releasing-an-update)
- [Configuration reference](#configuration-reference)
- [Verify and monitor](#verify-and-monitor)
- [Resilience tests](#resilience-tests)
- [Troubleshooting](#troubleshooting)
- [Lessons learned](#lessons-learned)
- [Hardening before real use](#hardening-before-real-use)
- [Cost control and cleanup](#cost-control-and-cleanup)

## Overview

| | |
|---|---|
| **Frontend** | Node.js 20 and Express. 2 replicas, exposed by an Azure LoadBalancer on port 80 (container port 3000). |
| **Database** | PostgreSQL 16 StatefulSet with 2 pods. `postgres-0` is the primary and `postgres-1` is a streaming replica. |
| **Registry** | Azure Container Registry `myacrrepo5312` |
| **Cluster** | AKS cluster `aks-cluster` in resource group `aks-rg` (North Europe) |
| **Namespace** | `state-app` |
| **Public URL** | `http://4.209.41.9` (the frontend LoadBalancer external IP) |

## Architecture

```
Browser -> Azure LoadBalancer :80 -> frontend pods (2) :3000
frontend -> postgres-primary Service -> postgres-0   (writes and normal reads)
frontend -> postgres-read Service    -> ready postgres pods (read-only fallback)
frontend -> Kubernetes API + direct probes            (status panel)
postgres-0 -> streaming replication -> postgres-1
```

### Database

- The StatefulSet gives stable pod names (`postgres-0`, `postgres-1`) and one 1Gi disk per pod.
- On its first start the primary creates a `replicator` role and adds a replication line to `pg_hba.conf`.
- The replica waits for the primary (`pg_isready`), clones it with `pg_basebackup`, then streams changes.
- `PGDATA` is a subfolder (`/var/lib/postgresql/data/pgdata`) because Azure disks contain a `lost+found` folder at the mount root, and Postgres will not initialise in a non-empty folder.
- Pods start one at a time (default `OrderedReady`), so the primary is ready before the replica clones it.
- There is no automatic failover. If `postgres-0` is down, writes stop until it returns. Data stays safe on its disk.

[![Azure portal: one 1Gi Bound volume claim per database pod](data/images/AKS%20PVC.png)](data/images/AKS%20PVC.png)

*Azure portal: one 1Gi `Bound` volume claim per database pod.*

### Services

| Service | Routes to | Used for |
|---|---|---|
| `postgres-headless` | all postgres pods (stable DNS) | Pod names, replica cloning |
| `postgres-primary` | only `postgres-0` | All writes |
| `postgres-read` | any ready postgres pod | Read-only fallback when the primary is down |
| `frontend` | frontend pods (type LoadBalancer) | Public access on port 80 |

[![Azure portal: the four Services in state-app](data/images/AKS%20Services.png)](data/images/AKS%20Services.png)

*Azure portal: the four Services in `state-app`. Only `frontend` has an external IP.*

### Frontend

- Creates its own table (`app_state`) at startup and retries until the database is reachable. If the table disappears at runtime, it recreates it.
- Reads pod state from the Kubernetes API (read-only RBAC) and connects directly to each database pod to report **Working**, **Restarting**, **Down** or **Not reachable**.
- If the primary is down, the switch becomes read-only and shows the value from the replica.

## Project layout

```
k8s-state-app/
  README.md
  app/
    Dockerfile
    package.json
    server.js
    public/index.html
  data/images/        (screenshots used in this README)
  k8s/
    00-namespace.yaml
    01-secret.yaml
    02-postgres-config.yaml
    03-postgres.yaml
    03a-frontend-rbac.yaml
    04-frontend.yaml
```

| File | What it does |
|---|---|
| `00-namespace.yaml` | Creates the `state-app` namespace |
| `01-secret.yaml` | Database and replication passwords |
| `02-postgres-config.yaml` | Entrypoint script (clones the primary) and primary init script |
| `03-postgres.yaml` | The three database Services and the StatefulSet |
| `03a-frontend-rbac.yaml` | Service account allowed to read (only) pod status |
| `04-frontend.yaml` | Frontend Deployment and public LoadBalancer Service |

[![Azure portal: the postgres-config ConfigMap](data/images/AKS%20Cluster%20config.png)](data/images/AKS%20Cluster%20config.png)

*Azure portal: the `postgres-config` ConfigMap holding the two database scripts.*

> [!IMPORTANT]
> **Keep only live manifests in `k8s/`.** `kubectl apply -f k8s/` applies every `.yaml` file in the folder in alphabetical order, including backups such as `04-frontend_old.yaml`. Use git history for old versions.

## Prerequisites

- On the machine you deploy from (here, the Jenkins host): Azure CLI logged in (`az login`), `kubectl`, Docker and git.
- An existing AKS cluster (`aks-cluster`) and ACR (`myacrrepo5312`) in resource group `aks-rg`.
- Permission to attach the ACR to the cluster (Owner or User Access Administrator on the ACR).
- Cluster nodes must be amd64 (x86_64), and so must the machine that builds the image.

## First deployment

Run every command from the project folder.

### 1. Get the code

```bash
git clone https://github.com/SasithWickrama/k8s-state-app.git
cd k8s-state-app
```

### 2. Connect kubectl to the cluster

```bash
az login
az aks get-credentials --resource-group aks-rg --name aks-cluster
kubectl get nodes
```

### 3. Let AKS pull images from the ACR

```bash
az aks update --resource-group aks-rg --name aks-cluster --attach-acr myacrrepo5312
az aks check-acr --resource-group aks-rg --name aks-cluster --acr myacrrepo5312.azurecr.io
```

### 4. Set the database passwords

> [!WARNING]
> Edit `k8s/01-secret.yaml` **before the first apply**. Postgres reads the passwords only when it first initialises its data folder, so changing the Secret later does not change the database.

### 5. Build and push the image

Build locally with Docker. `az acr build` may be blocked on your subscription (see [Lessons learned](#lessons-learned)).

```bash
az acr login --name myacrrepo5312
docker build -t myacrrepo5312.azurecr.io/state-app:1.0 ./app
docker push myacrrepo5312.azurecr.io/state-app:1.0
az acr repository show-tags --name myacrrepo5312 --repository state-app
```

[![Azure portal: the state-app repository with the pushed image tags](data/images/ACR%20repo.png)](data/images/ACR%20repo.png)

*Azure portal: the `state-app` repository in `myacrrepo5312` with the pushed image tags.*

### 6. Check the image line in `k8s/04-frontend.yaml`

It must use the full registry path and the tag you just pushed:

```yaml
image: myacrrepo5312.azurecr.io/state-app:1.0
```

### 7. Apply everything and watch it start

```bash
kubectl apply -f k8s/
kubectl -n state-app get pods -w
```

After 1 to 2 minutes you should see `postgres-0`, `postgres-1` and two `frontend` pods, all `Running` and `1/1`.

[![Azure portal: both frontend pods Running and 1/1](data/images/AKS%20Front%20end%20pods.png)](data/images/AKS%20Front%20end%20pods.png)

*Azure portal: both frontend pods are `Running` and `1/1` with 0 restarts.*

### 8. Open the app

```bash
kubectl -n state-app get svc frontend
```

When `EXTERNAL-IP` shows an address, open `http://EXTERNAL-IP` in a browser. It can take 1 to 3 minutes to appear.

[![The app in the browser: switch On and both database pods Working](data/images/Front%20end%20view.png)](data/images/Front%20end%20view.png)

*The app in the browser: the switch, the banner "All databases are working", and one status card per database pod.*

## Releasing an update

Use a **new image tag for every release**. Replace `1.5` below with the next unused number.

```bash
cd ~/k8s-state-app
git pull

# sanity check: the new files are really there (prints a number above 0)
grep -c banner app/public/index.html

sed -i 's#state-app:[0-9.]*#state-app:1.5#' k8s/04-frontend.yaml
grep -n image: k8s/04-frontend.yaml

docker build -t myacrrepo5312.azurecr.io/state-app:1.5 ./app
docker push myacrrepo5312.azurecr.io/state-app:1.5

kubectl apply -f k8s/
kubectl -n state-app rollout status deployment/frontend
```

Then verify from outside the browser:

```bash
for i in $(seq 1 6); do curl -s http://4.209.41.9/ | grep -c banner; done
kubectl -n state-app get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image
```

Every line should be above 0 and every frontend pod should show the new tag. Then hard-refresh the browser (Ctrl+Shift+R) or use a private window.

> [!TIP]
> If the new pod stays `0/1`, the old pods keep serving, so the site stays up. Run `kubectl -n state-app describe pod POD-NAME | tail -20` to see why.

## Configuration reference

### Frontend environment variables

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` | `localhost` (manifest: `postgres-primary`) | Primary database host, used for writes |
| `DB_READ_HOST` | `postgres-read` | Read-only fallback host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `appdb` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | none | Taken from the `postgres-secret` Secret |
| `DB_PODS` | `postgres-0,postgres-1` | Pods shown in the status panel |
| `DB_HEADLESS` | `postgres-headless` | DNS fallback when the Kubernetes API is unavailable |
| `PORT` | `3000` | Port the app listens on |

### HTTP endpoints

| Path | Purpose |
|---|---|
| `GET /api/state` | Current switch value. Falls back to a read-only value from the replica if the primary is down. |
| `POST /api/toggle` | Flips the switch (primary only) |
| `GET /api/status` | Status of each database pod (feeds the status panel) |
| `GET /livez` | Process is alive. Never touches the database. |
| `GET /healthz` | Runs `SELECT 1`. Readiness check: no traffic if the database is unreachable. |

### Probes

| Probe | Path | Why |
|---|---|---|
| Startup | `/livez` | Allows up to 5 minutes for the database to come up on first start |
| Readiness | `/healthz` | Pod receives traffic only when it can reach the database |
| Liveness | `/livez` | Restarts the pod only if the process itself hangs, never because of a database outage |

### Status panel states

| State | Meaning |
|---|---|
| Working | The pod is up and answers queries |
| Restarting | The pod is shutting down or starting, or Postgres is still booting |
| Down | The pod does not exist (scaled down or deleted) or is crash-looping |
| Not reachable | The pod is Ready but the database does not answer |

## Verify and monitor

### Database status

```bash
kubectl -n state-app get pods,pvc,svc
kubectl -n state-app exec postgres-0 -- pg_isready -U postgres
kubectl -n state-app exec postgres-0 -- psql -U postgres -tc 'select pg_is_in_recovery()'
kubectl -n state-app exec postgres-1 -- psql -U postgres -tc 'select pg_is_in_recovery()'
kubectl -n state-app exec postgres-0 -- psql -U postgres -c 'select client_addr, state, replay_lag from pg_stat_replication'
kubectl -n state-app exec postgres-0 -- psql -U postgres -d appdb -c 'select * from app_state'
kubectl -n state-app exec postgres-1 -- psql -U postgres -d appdb -c 'select * from app_state'
curl -s http://4.209.41.9/api/status
curl -s http://4.209.41.9/healthz
```

Healthy results: the primary returns `f` and the replica returns `t`; one replication row with state `streaming`; both `app_state` tables show the same value; `/healthz` returns `ok`.

[![Terminal output of the verification commands](data/images/Verify%20and%20monitor.png)](data/images/Verify%20and%20monitor.png)

*Terminal output of the verification commands. Click the image to open it full size.*

### Live view

Press Ctrl+C to stop any of these.

```bash
kubectl -n state-app get pods -w
kubectl -n state-app logs -f deploy/frontend
kubectl -n state-app logs -f postgres-0
kubectl -n state-app logs -f postgres-1
watch -n 2 kubectl -n state-app get pods
kubectl -n state-app top pods
```

## Resilience tests

Keep the page open and watch the status cards while you run these. After each test, reload the page: the switch must keep its value.

```bash
# replica restarts, then returns to Working
kubectl -n state-app delete pod postgres-1

# primary restarts: writes blocked, replica serves a read-only value
kubectl -n state-app delete pod postgres-0

# replica is Down until restored
kubectl -n state-app scale statefulset postgres --replicas=1
kubectl -n state-app scale statefulset postgres --replicas=2

# frontend pod restarts: the page keeps working through the other pod
kubectl -n state-app delete pod FRONTEND-POD-NAME
```

Scaling the StatefulSet down keeps the disks, so the replica rejoins with its data.

## Troubleshooting

Start with these four commands:

```bash
kubectl -n state-app get pods
kubectl -n state-app describe pod POD-NAME | tail -20
kubectl -n state-app logs deploy/frontend --tail=30
kubectl -n state-app get events --sort-by=.lastTimestamp | tail -20
```

| Symptom | Likely cause |
|---|---|
| `ImagePullBackOff` or 401 | Wrong image path, tag not pushed, or ACR not attached to the cluster |
| `exec format error` | Image built for the wrong CPU architecture |
| Frontend `0/1`, probe returns 404 | The running image does not contain the route the probe calls |
| Frontend `0/1`, logs say *waiting for database* | Postgres not ready yet, or wrong `DB_HOST` |
| `password authentication failed` | The Secret changed after the database was first initialised |
| `relation "app_state" does not exist` | Database recreated under a running app. Restart the frontend (new versions recover on their own). |
| `postgres-1` stuck, logs say *Waiting for primary* | `postgres-0` is not Ready |
| `EXTERNAL-IP` stays pending | Wait a few minutes, then describe the Service for quota or permission errors |
| Page looks old | Stale browser cache, cached image under a reused tag, or stale files in the build |
| Pod `Pending` with a volume event | Check the PVC and the default storage class (`managed-csi` on AKS) |

## Lessons learned

### Images and registry

| Problem | What happened | Do this |
|---|---|---|
| Short image name | `image: state-app:1.0` only works on local clusters (minikube, kind). AKS looked on Docker Hub and failed with ImagePullBackOff. | Use the full path `myacrrepo5312.azurecr.io/state-app:TAG`. |
| ACR not attached | Pulls failed with 401 Unauthorized even with the right name. | Run `az aks update --attach-acr`, check with `az aks check-acr`. |
| ACR Tasks blocked | `az acr build` failed with `TasksOperationsNotAllowed` (common on free and student subscriptions). | Build with Docker locally, then `az acr login` and `docker push`. |
| Backup manifest applied | A leftover `04-frontend_old.yaml` sorted after `04-frontend.yaml`, so every apply reset the Deployment to the old image and probes. The clue was `deployment.apps/frontend` printed twice. | Keep backups out of `k8s/`. Use git history. |
| Reused image tag | Nodes cache images and `IfNotPresent` never pulls again, so changed code can run under an old tag. | Use a new tag for every build. |
| Wrong CPU architecture | AKS nodes are amd64. An image built on ARM fails with `exec format error`. | Build on an x86_64 machine. |

### Files and workflow

| Problem | What happened | Do this |
|---|---|---|
| Stale files in the build | The new `index.html` was not in `app/public`, so the image had the new server and the old page. | Check with `grep -c banner app/public/index.html`. Check inside the pod with `kubectl -n state-app exec deploy/frontend -- grep -c banner /app/public/index.html`. Compare the pod's `imageID` digest with the one printed by `docker push`. |
| Wrong folder | `path ./app not found` and `path k8s/ does not exist`. | Run commands from the project folder; paths are relative. |
| Repeated scripted edit | A `sed` that inserts a line added another copy each run, creating duplicate `serviceAccountName` keys. | Make edits safe to repeat, and check with `grep -n` afterwards. |
| Docker permission denied | The user cannot use the Docker socket. | Use `sudo`, or add the user to the `docker` group and log in again. |

### Probes and rollouts

| Problem | What happened | Do this |
|---|---|---|
| Stuck rollout | The new pod stayed `0/1` while two old pods kept the site up. | A stuck rollout means the new version is broken, not the site. Use `rollout status` and `describe pod`. |
| Probe path missing | The manifest probed `/livez` but the running image was the old build without it, so the probe got 404. | Ship the code that serves a path before, or together with, the manifest that probes it. |
| Liveness tied to the database | If liveness runs a query, a short database outage restarts every frontend pod. | Liveness uses a process-only `/livez`. Readiness checks the database. Add a startup probe for slow first starts. |

### Database

| Problem | What happened | Do this |
|---|---|---|
| Password change did nothing | Postgres reads the passwords only when initialising an empty data folder. Editing the Secret later made the app and database disagree. | Decide passwords before the first deploy. To change later, use `ALTER ROLE` or delete the data and start fresh. |
| Database recreated under a running app | The app logged *schema ready*, then failed with `relation app_state does not exist` while readiness still passed. | Restart the frontend. Current versions recreate the table by themselves. |
| Duplicate key error at startup | Two frontend pods created the same table at the same moment and one lost the race. | Harmless. The loser retries and succeeds. |
| Data loss | Deleting a PersistentVolumeClaim deletes the data. Deleting a pod or scaling the StatefulSet does not. | Delete PVCs only on purpose. |
| Replica expectations | The replica is read-only and there is no failover. | Only `postgres-0` accepts writes (see [Hardening](#hardening-before-real-use)). |

### Access and tooling

| Problem | What happened | Do this |
|---|---|---|
| Port-forward failed | Local port 8080 was already used (Jenkins runs there), and the Service port is 80, not 8080. | `kubectl -n state-app port-forward svc/frontend 8081:80`, or just use the LoadBalancer IP. |
| Page still looks old | Browsers cache the page. | Hard refresh (Ctrl+Shift+R) or a private window, and check what the cluster serves with `curl`. |
| Warnings in the output | Docker says the legacy builder is deprecated. kubectl says v1 Endpoints is deprecated. | Both are harmless. Installing buildx is optional. |

## Hardening before real use

- Change the placeholder passwords before the first deploy and never commit real ones. Use Azure Key Vault or a sealed secret.
- Stop connecting as the `postgres` superuser. Create a limited application user.
- Add HTTPS with an ingress controller and a certificate. The LoadBalancer serves plain HTTP on a public IP.
- Add a NetworkPolicy so only the frontend can reach the database pods (network policy must be enabled on the cluster).
- Get automatic failover from a Postgres operator (such as CloudNativePG) or use Azure Database for PostgreSQL Flexible Server, which also gives backups.
- Take backups and test a restore. Replication is not a backup.
- Pin image versions (for example `postgres:16.x`) and scan images in the ACR.
- Keep the frontend service account read-only (pods `get` and `list` only), as in `03a-frontend-rbac.yaml`.
- Add CPU limits as well as memory limits, and consider a PodDisruptionBudget.

## Cost control and cleanup

```bash
# pause the cluster when not in use
az aks stop --resource-group aks-rg --name aks-cluster
az aks start --resource-group aks-rg --name aks-cluster

# remove the app and its data disks (the cluster stays)
kubectl delete namespace state-app

# remove everything, including the cluster and registry
az group delete --name aks-rg
```

After a stop and start, check the frontend Service again with `kubectl -n state-app get svc frontend`, in case the external IP changed.

---

Last updated November 27, 2026.
