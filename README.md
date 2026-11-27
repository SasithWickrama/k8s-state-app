<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Persistent Switch on AKS: Deployment README</title>
<style>
  :root {
    --bg:#f4f7f6; --ink:#14201d; --muted:#4f625d; --panel:#ffffff; --line:#d3ddd9;
    --accent:#1f8a5b; --code-bg:#e9f0ed; --warn:#b9770e; --bad:#c2362f;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#10181a; --ink:#e6efec; --muted:#9fb2ac; --panel:#162224; --line:#2b3b3d;
      --accent:#3ccf8e; --code-bg:#0c1315; --warn:#f2b84b; --bad:#ff7b72;
      color-scheme: dark;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 20px; }
  body { margin:0; background:var(--bg); color:var(--ink); line-height:1.6;
         font-family:"Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif; font-size:16px; }
  .layout { display:grid; grid-template-columns:230px minmax(0,1fr); gap:48px;
            max-width:1160px; margin:0 auto; padding:32px 24px 80px; }
  nav { position:sticky; top:24px; align-self:start; font-size:.92rem; max-height:calc(100vh - 48px); overflow:auto; }
  nav strong { display:block; margin-bottom:10px; }
  nav a { display:block; padding:4px 0 4px 12px; color:var(--muted); text-decoration:none; border-left:2px solid var(--line); }
  nav a:hover, nav a:focus-visible { color:var(--ink); border-left-color:var(--accent); outline:none; }
  main { min-width:0; max-width:860px; }
  header { margin-bottom:40px; }
  h1 { font-size:2rem; line-height:1.2; margin:0 0 12px; }
  h2 { font-size:1.45rem; margin:56px 0 12px; padding-top:20px; border-top:1px solid var(--line); line-height:1.25; }
  h3 { font-size:1.08rem; margin:28px 0 8px; }
  p { margin:0 0 14px; max-width:75ch; }
  ul, ol { margin:0 0 16px; padding-left:22px; max-width:75ch; }
  li { margin:4px 0; }
  a { color:var(--accent); }
  .lede { font-size:1.08rem; color:var(--muted); }
  code { font-family:ui-monospace,"Cascadia Code",Consolas,Menlo,monospace; font-size:.88em;
         background:var(--code-bg); padding:1px 5px; border-radius:4px; }
  pre { position:relative; margin:0 0 18px; background:var(--code-bg); border:1px solid var(--line);
        border-radius:6px; padding:14px 16px; overflow-x:auto; }
  pre code { background:none; padding:0; font-size:.86rem; line-height:1.5; display:block; white-space:pre; }
  .copy { position:absolute; top:8px; right:8px; font:inherit; font-size:.78rem; padding:3px 9px;
          color:var(--ink); background:var(--panel); border:1px solid var(--line); border-radius:4px; cursor:pointer; }
  .copy:hover { border-color:var(--accent); }
  .copy:focus-visible { outline:2px solid var(--accent); }
  .tablewrap { overflow-x:auto; margin:0 0 18px; }
  table { border-collapse:collapse; width:100%; background:var(--panel); border:1px solid var(--line); font-size:.93rem; }
  th, td { text-align:left; vertical-align:top; padding:9px 12px; border-bottom:1px solid var(--line); }
  th { background:var(--code-bg); font-weight:600; white-space:nowrap; }
  tr:last-child td { border-bottom:0; }
  .note { margin:0 0 18px; padding:12px 16px; background:var(--panel); border:1px solid var(--line);
          border-left:5px solid var(--warn); max-width:75ch; }
  .note.good { border-left-color:var(--accent); }
  .note p:last-child { margin-bottom:0; }
  .steps { list-style:none; counter-reset:step; padding:0; max-width:none; }
  .steps > li { counter-increment:step; position:relative; padding:0 0 4px 44px; margin:0 0 18px; }
  .steps > li::before { content:counter(step); position:absolute; left:0; top:0; width:30px; height:30px;
          border-radius:50%; background:var(--accent); color:var(--bg); font-weight:700; text-align:center; line-height:30px; }
  .steps > li > p:first-child { font-weight:600; margin-bottom:8px; }
  figure { margin:0 0 22px; max-width:100%; }
  figure a { display:block; }
  figure img { display:block; width:100%; height:auto; border:1px solid var(--line); border-radius:6px; background:var(--panel); }
  figcaption { margin-top:6px; font-size:.86rem; color:var(--muted); max-width:75ch; }
  footer { margin-top:64px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:.88rem; }
  @media (max-width: 900px) {
    .layout { grid-template-columns:1fr; gap:16px; padding-top:20px; }
    nav { position:static; max-height:none; border:1px solid var(--line); background:var(--panel); padding:12px 16px; }
    nav a { display:inline-block; margin-right:12px; border-left:0; padding:3px 0; }
  }
  @media print { nav, .copy { display:none; } .layout { display:block; } body { background:#fff; color:#000; } }
</style>
</head>
<body>
<div class="layout">

<nav aria-label="Contents">
  <strong>Contents</strong>
  <a href="#overview">Overview</a>
  <a href="#architecture">Architecture</a>
  <a href="#layout">Project layout</a>
  <a href="#prerequisites">Prerequisites</a>
  <a href="#deploy">First deployment</a>
  <a href="#release">Releasing an update</a>
  <a href="#config">Configuration reference</a>
  <a href="#verify">Verify and monitor</a>
  <a href="#resilience">Resilience tests</a>
  <a href="#troubleshooting">Troubleshooting</a>
  <a href="#lessons">Lessons learned</a>
  <a href="#hardening">Hardening</a>
  <a href="#cleanup">Cost control and cleanup</a>
</nav>

<main>
<header>
  <h1>Persistent Switch on Azure AKS</h1>
  <p class="lede">A web page with one on/off switch whose value is stored in PostgreSQL, so it survives the restart of any pod. The page also shows the live health of both database pods. This README covers how to deploy, update, check and troubleshoot it on AKS.</p>
</header>

<section id="overview">
<h2>Overview</h2>
<div class="tablewrap"><table>
  <tr><th>Frontend</th><td>Node.js 20 and Express. 2 replicas, exposed by an Azure LoadBalancer on port 80 (container port 3000).</td></tr>
  <tr><th>Database</th><td>PostgreSQL 16 StatefulSet with 2 pods. <code>postgres-0</code> is the primary and <code>postgres-1</code> is a streaming replica.</td></tr>
  <tr><th>Registry</th><td>Azure Container Registry <code>myacrrepo5312</code></td></tr>
  <tr><th>Cluster</th><td>AKS cluster <code>aks-cluster</code> in resource group <code>aks-rg</code> (North Europe)</td></tr>
  <tr><th>Namespace</th><td><code>state-app</code></td></tr>
  <tr><th>Public URL</th><td><code>http://4.209.41.9</code> (the frontend LoadBalancer external IP)</td></tr>
</table></div>
</section>

<section id="architecture">
<h2>Architecture</h2>
<pre data-nocopy><code>Browser -&gt; Azure LoadBalancer :80 -&gt; frontend pods (2) :3000
frontend -&gt; postgres-primary Service -&gt; postgres-0   (writes and normal reads)
frontend -&gt; postgres-read Service    -&gt; ready postgres pods (read-only fallback)
frontend -&gt; Kubernetes API + direct probes            (status panel)
postgres-0 -&gt; streaming replication -&gt; postgres-1</code></pre>

<h3>Database</h3>
<ul>
  <li>The StatefulSet gives stable pod names (<code>postgres-0</code>, <code>postgres-1</code>) and one 1Gi disk per pod.</li>
  <li>On its first start the primary creates a <code>replicator</code> role and adds a replication line to <code>pg_hba.conf</code>.</li>
  <li>The replica waits for the primary (<code>pg_isready</code>), clones it with <code>pg_basebackup</code>, then streams changes.</li>
  <li><code>PGDATA</code> is a subfolder (<code>/var/lib/postgresql/data/pgdata</code>) because Azure disks contain a <code>lost+found</code> folder at the mount root, and Postgres will not initialise in a non-empty folder.</li>
  <li>Pods start one at a time (default <code>OrderedReady</code>), so the primary is ready before the replica clones it.</li>
  <li>There is no automatic failover. If <code>postgres-0</code> is down, writes stop until it returns. Data stays safe on its disk.</li>
</ul>
<figure>
  <a href="data/images/AKS%20PVC.png" target="_blank" rel="noopener"><img src="data/images/AKS%20PVC.png" width="1362" height="546" loading="lazy" alt="Azure portal showing data-postgres-0 and data-postgres-1 volume claims Bound at 1Gi"></a>
  <figcaption>Azure portal: one 1Gi <code>Bound</code> volume claim per database pod.</figcaption>
</figure>

<h3>Services</h3>
<div class="tablewrap"><table>
  <tr><th>Service</th><th>Routes to</th><th>Used for</th></tr>
  <tr><td><code>postgres-headless</code></td><td>all postgres pods (stable DNS)</td><td>Pod names, replica cloning</td></tr>
  <tr><td><code>postgres-primary</code></td><td>only <code>postgres-0</code></td><td>All writes</td></tr>
  <tr><td><code>postgres-read</code></td><td>any ready postgres pod</td><td>Read-only fallback when the primary is down</td></tr>
  <tr><td><code>frontend</code></td><td>frontend pods (type LoadBalancer)</td><td>Public access on port 80</td></tr>
</table></div>
<figure>
  <a href="data/images/AKS%20Services.png" target="_blank" rel="noopener"><img src="data/images/AKS%20Services.png" width="1363" height="621" loading="lazy" alt="Azure portal listing the postgres-headless, postgres-primary, postgres-read and frontend services"></a>
  <figcaption>Azure portal: the four Services in <code>state-app</code>. Only <code>frontend</code> has an external IP.</figcaption>
</figure>

<h3>Frontend</h3>
<ul>
  <li>Creates its own table (<code>app_state</code>) at startup and retries until the database is reachable. If the table disappears at runtime, it recreates it.</li>
  <li>Reads pod state from the Kubernetes API (read-only RBAC) and connects directly to each database pod to report <strong>Working</strong>, <strong>Restarting</strong>, <strong>Down</strong> or <strong>Not reachable</strong>.</li>
  <li>If the primary is down, the switch becomes read-only and shows the value from the replica.</li>
</ul>
</section>

<section id="layout">
<h2>Project layout</h2>
<pre data-nocopy><code>k8s-state-app/
  README.html
  app/
    Dockerfile
    package.json
    server.js
    public/index.html
  k8s/
    00-namespace.yaml
    01-secret.yaml
    02-postgres-config.yaml
    03-postgres.yaml
    03a-frontend-rbac.yaml
    04-frontend.yaml</code></pre>
<div class="tablewrap"><table>
  <tr><th>File</th><th>What it does</th></tr>
  <tr><td><code>00-namespace.yaml</code></td><td>Creates the <code>state-app</code> namespace</td></tr>
  <tr><td><code>01-secret.yaml</code></td><td>Database and replication passwords</td></tr>
  <tr><td><code>02-postgres-config.yaml</code></td><td>Entrypoint script (clones the primary) and primary init script</td></tr>
  <tr><td><code>03-postgres.yaml</code></td><td>The three database Services and the StatefulSet</td></tr>
  <tr><td><code>03a-frontend-rbac.yaml</code></td><td>Service account allowed to read (only) pod status</td></tr>
  <tr><td><code>04-frontend.yaml</code></td><td>Frontend Deployment and public LoadBalancer Service</td></tr>
</table></div>
<figure>
  <a href="data/images/AKS%20Cluster%20config.png" target="_blank" rel="noopener"><img src="data/images/AKS%20Cluster%20config.png" width="1358" height="632" loading="lazy" alt="Azure portal showing the postgres-config ConfigMap in the state-app namespace"></a>
  <figcaption>Azure portal: the <code>postgres-config</code> ConfigMap holding the two database scripts.</figcaption>
</figure>
<div class="note"><p><strong>Keep only live manifests in <code>k8s/</code>.</strong> <code>kubectl apply -f k8s/</code> applies every <code>.yaml</code> file in the folder in alphabetical order, including backups such as <code>04-frontend_old.yaml</code>. Use git history for old versions.</p></div>
</section>

<section id="prerequisites">
<h2>Prerequisites</h2>
<ul>
  <li>On the machine you deploy from (here, the Jenkins host): Azure CLI logged in (<code>az login</code>), <code>kubectl</code>, Docker and git.</li>
  <li>An existing AKS cluster (<code>aks-cluster</code>) and ACR (<code>myacrrepo5312</code>) in resource group <code>aks-rg</code>.</li>
  <li>Permission to attach the ACR to the cluster (Owner or User Access Administrator on the ACR).</li>
  <li>Cluster nodes must be amd64 (x86_64), and so must the machine that builds the image.</li>
</ul>
</section>

<section id="deploy">
<h2>First deployment</h2>
<p>Run every command from the project folder.</p>
<ol class="steps">
  <li><p>Get the code</p>
<pre><code>git clone https://github.com/SasithWickrama/k8s-state-app.git
cd k8s-state-app</code></pre></li>

  <li><p>Connect kubectl to the cluster</p>
<pre><code>az login
az aks get-credentials --resource-group aks-rg --name aks-cluster
kubectl get nodes</code></pre></li>

  <li><p>Let AKS pull images from the ACR</p>
<pre><code>az aks update --resource-group aks-rg --name aks-cluster --attach-acr myacrrepo5312
az aks check-acr --resource-group aks-rg --name aks-cluster --acr myacrrepo5312.azurecr.io</code></pre></li>

  <li><p>Set the database passwords</p>
    <div class="note"><p>Edit <code>k8s/01-secret.yaml</code> <strong>before the first apply</strong>. Postgres reads the passwords only when it first initialises its data folder, so changing the Secret later does not change the database.</p></div></li>

  <li><p>Build and push the image</p>
    <p>Build locally with Docker. <code>az acr build</code> may be blocked on your subscription (see Lessons learned).</p>
<pre><code>az acr login --name myacrrepo5312
docker build -t myacrrepo5312.azurecr.io/state-app:1.0 ./app
docker push myacrrepo5312.azurecr.io/state-app:1.0
az acr repository show-tags --name myacrrepo5312 --repository state-app</code></pre>
<figure>
  <a href="data/images/ACR%20repo.png" target="_blank" rel="noopener"><img src="data/images/ACR%20repo.png" width="1363" height="635" loading="lazy" alt="Azure portal showing the state-app repository in myacrrepo5312 with tags 1.0 to 1.4"></a>
  <figcaption>Azure portal: the <code>state-app</code> repository in <code>myacrrepo5312</code> with the pushed image tags.</figcaption>
</figure></li>

  <li><p>Check the image line in <code>k8s/04-frontend.yaml</code></p>
    <p>It must use the full registry path and the tag you just pushed:</p>
<pre><code>image: myacrrepo5312.azurecr.io/state-app:1.0</code></pre></li>

  <li><p>Apply everything and watch it start</p>
<pre><code>kubectl apply -f k8s/
kubectl -n state-app get pods -w</code></pre>
    <p>After 1 to 2 minutes you should see <code>postgres-0</code>, <code>postgres-1</code> and two <code>frontend</code> pods, all <code>Running</code> and <code>1/1</code>.</p>
<figure>
  <a href="data/images/AKS%20Front%20end%20pods.png" target="_blank" rel="noopener"><img src="data/images/AKS%20Front%20end%20pods.png" width="1360" height="577" loading="lazy" alt="Azure portal showing two frontend pods Running and Ready 1/1"></a>
  <figcaption>Azure portal: both frontend pods are <code>Running</code> and <code>1/1</code> with 0 restarts.</figcaption>
</figure></li>

  <li><p>Open the app</p>
<pre><code>kubectl -n state-app get svc frontend</code></pre>
    <p>When <code>EXTERNAL-IP</code> shows an address, open <code>http://EXTERNAL-IP</code> in a browser. It can take 1 to 3 minutes to appear.</p>
<figure>
  <a href="data/images/Front%20end%20view.png" target="_blank" rel="noopener"><img src="data/images/Front%20end%20view.png" width="1912" height="920" loading="lazy" alt="The app in a browser: switch is On and both database pods show Working"></a>
  <figcaption>The app in the browser: the switch, the banner <em>All databases are working</em>, and one status card per database pod.</figcaption>
</figure></li>
</ol>
</section>

<section id="release">
<h2>Releasing an update</h2>
<p>Use a <strong>new image tag for every release</strong>. Replace <code>1.5</code> below with the next unused number.</p>
<pre><code>cd ~/k8s-state-app
git pull

# sanity check: the new files are really there (prints a number above 0)
grep -c banner app/public/index.html

sed -i 's#state-app:[0-9.]*#state-app:1.5#' k8s/04-frontend.yaml
grep -n image: k8s/04-frontend.yaml

docker build -t myacrrepo5312.azurecr.io/state-app:1.5 ./app
docker push myacrrepo5312.azurecr.io/state-app:1.5

kubectl apply -f k8s/
kubectl -n state-app rollout status deployment/frontend</code></pre>
<p>Then verify from outside the browser:</p>
<pre><code>for i in $(seq 1 6); do curl -s http://4.209.41.9/ | grep -c banner; done
kubectl -n state-app get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image</code></pre>
<p>Every line should be above 0 and every frontend pod should show the new tag. Then hard-refresh the browser (Ctrl+Shift+R) or use a private window.</p>
<div class="note good"><p>If the new pod stays <code>0/1</code>, the old pods keep serving, so the site stays up. Run <code>kubectl -n state-app describe pod POD-NAME | tail -20</code> to see why.</p></div>
</section>

<section id="config">
<h2>Configuration reference</h2>
<h3>Frontend environment variables</h3>
<div class="tablewrap"><table>
  <tr><th>Variable</th><th>Default</th><th>Meaning</th></tr>
  <tr><td><code>DB_HOST</code></td><td><code>localhost</code> (manifest: <code>postgres-primary</code>)</td><td>Primary database host, used for writes</td></tr>
  <tr><td><code>DB_READ_HOST</code></td><td><code>postgres-read</code></td><td>Read-only fallback host</td></tr>
  <tr><td><code>DB_PORT</code></td><td><code>5432</code></td><td>Database port</td></tr>
  <tr><td><code>DB_NAME</code></td><td><code>appdb</code></td><td>Database name</td></tr>
  <tr><td><code>DB_USER</code></td><td><code>postgres</code></td><td>Database user</td></tr>
  <tr><td><code>DB_PASSWORD</code></td><td>none</td><td>Taken from the <code>postgres-secret</code> Secret</td></tr>
  <tr><td><code>DB_PODS</code></td><td><code>postgres-0,postgres-1</code></td><td>Pods shown in the status panel</td></tr>
  <tr><td><code>DB_HEADLESS</code></td><td><code>postgres-headless</code></td><td>DNS fallback when the Kubernetes API is unavailable</td></tr>
  <tr><td><code>PORT</code></td><td><code>3000</code></td><td>Port the app listens on</td></tr>
</table></div>

<h3>HTTP endpoints</h3>
<div class="tablewrap"><table>
  <tr><th>Path</th><th>Purpose</th></tr>
  <tr><td><code>GET /api/state</code></td><td>Current switch value. Falls back to a read-only value from the replica if the primary is down.</td></tr>
  <tr><td><code>POST /api/toggle</code></td><td>Flips the switch (primary only)</td></tr>
  <tr><td><code>GET /api/status</code></td><td>Status of each database pod (feeds the status panel)</td></tr>
  <tr><td><code>GET /livez</code></td><td>Process is alive. Never touches the database.</td></tr>
  <tr><td><code>GET /healthz</code></td><td>Runs <code>SELECT 1</code>. Readiness check: no traffic if the database is unreachable.</td></tr>
</table></div>

<h3>Probes</h3>
<div class="tablewrap"><table>
  <tr><th>Probe</th><th>Path</th><th>Why</th></tr>
  <tr><td>Startup</td><td><code>/livez</code></td><td>Allows up to 5 minutes for the database to come up on first start</td></tr>
  <tr><td>Readiness</td><td><code>/healthz</code></td><td>Pod receives traffic only when it can reach the database</td></tr>
  <tr><td>Liveness</td><td><code>/livez</code></td><td>Restarts the pod only if the process itself hangs, never because of a database outage</td></tr>
</table></div>

<h3>Status panel states</h3>
<div class="tablewrap"><table>
  <tr><th>State</th><th>Meaning</th></tr>
  <tr><td>Working</td><td>The pod is up and answers queries</td></tr>
  <tr><td>Restarting</td><td>The pod is shutting down or starting, or Postgres is still booting</td></tr>
  <tr><td>Down</td><td>The pod does not exist (scaled down or deleted) or is crash-looping</td></tr>
  <tr><td>Not reachable</td><td>The pod is Ready but the database does not answer</td></tr>
</table></div>
</section>

<section id="verify">
<h2>Verify and monitor</h2>
<h3>Database status</h3>
<pre><code>kubectl -n state-app get pods,pvc,svc
kubectl -n state-app exec postgres-0 -- pg_isready -U postgres
kubectl -n state-app exec postgres-0 -- psql -U postgres -tc 'select pg_is_in_recovery()'
kubectl -n state-app exec postgres-1 -- psql -U postgres -tc 'select pg_is_in_recovery()'
kubectl -n state-app exec postgres-0 -- psql -U postgres -c 'select client_addr, state, replay_lag from pg_stat_replication'
kubectl -n state-app exec postgres-0 -- psql -U postgres -d appdb -c 'select * from app_state'
kubectl -n state-app exec postgres-1 -- psql -U postgres -d appdb -c 'select * from app_state'
curl -s http://4.209.41.9/api/status
curl -s http://4.209.41.9/healthz</code></pre>
<p>Healthy results: the primary returns <code>f</code> and the replica returns <code>t</code>; one replication row with state <code>streaming</code>; both <code>app_state</code> tables show the same value; <code>/healthz</code> returns <code>ok</code>.</p>
<figure>
  <a href="data/images/Verify%20and%20monitor.png" target="_blank" rel="noopener"><img src="data/images/Verify%20and%20monitor.png" width="1914" height="997" loading="lazy" alt="Terminal output of the verification commands showing pods, volumes, services and replication streaming"></a>
  <figcaption>Terminal output of the verification commands. Click the image to open it full size.</figcaption>
</figure>

<h3>Live view</h3>
<p>Press Ctrl+C to stop any of these.</p>
<pre><code>kubectl -n state-app get pods -w
kubectl -n state-app logs -f deploy/frontend
kubectl -n state-app logs -f postgres-0
kubectl -n state-app logs -f postgres-1
watch -n 2 kubectl -n state-app get pods
kubectl -n state-app top pods</code></pre>
</section>

<section id="resilience">
<h2>Resilience tests</h2>
<p>Keep the page open and watch the status cards while you run these. After each test, reload the page: the switch must keep its value.</p>
<pre><code># replica restarts, then returns to Working
kubectl -n state-app delete pod postgres-1

# primary restarts: writes blocked, replica serves a read-only value
kubectl -n state-app delete pod postgres-0

# replica is Down until restored
kubectl -n state-app scale statefulset postgres --replicas=1
kubectl -n state-app scale statefulset postgres --replicas=2

# frontend pod restarts: the page keeps working through the other pod
kubectl -n state-app delete pod FRONTEND-POD-NAME</code></pre>
<p>Scaling the StatefulSet down keeps the disks, so the replica rejoins with its data.</p>
</section>

<section id="troubleshooting">
<h2>Troubleshooting</h2>
<p>Start with these four commands:</p>
<pre><code>kubectl -n state-app get pods
kubectl -n state-app describe pod POD-NAME | tail -20
kubectl -n state-app logs deploy/frontend --tail=30
kubectl -n state-app get events --sort-by=.lastTimestamp | tail -20</code></pre>
<div class="tablewrap"><table>
  <tr><th>Symptom</th><th>Likely cause</th></tr>
  <tr><td><code>ImagePullBackOff</code> or 401</td><td>Wrong image path, tag not pushed, or ACR not attached to the cluster</td></tr>
  <tr><td><code>exec format error</code></td><td>Image built for the wrong CPU architecture</td></tr>
  <tr><td>Frontend <code>0/1</code>, probe returns 404</td><td>The running image does not contain the route the probe calls</td></tr>
  <tr><td>Frontend <code>0/1</code>, logs say <em>waiting for database</em></td><td>Postgres not ready yet, or wrong <code>DB_HOST</code></td></tr>
  <tr><td><code>password authentication failed</code></td><td>The Secret changed after the database was first initialised</td></tr>
  <tr><td><code>relation "app_state" does not exist</code></td><td>Database recreated under a running app. Restart the frontend (new versions recover on their own).</td></tr>
  <tr><td><code>postgres-1</code> stuck, logs say <em>Waiting for primary</em></td><td><code>postgres-0</code> is not Ready</td></tr>
  <tr><td><code>EXTERNAL-IP</code> stays pending</td><td>Wait a few minutes, then describe the Service for quota or permission errors</td></tr>
  <tr><td>Page looks old</td><td>Stale browser cache, cached image under a reused tag, or stale files in the build</td></tr>
  <tr><td>Pod <code>Pending</code> with a volume event</td><td>Check the PVC and the default storage class (<code>managed-csi</code> on AKS)</td></tr>
</table></div>
</section>

<section id="lessons">
<h2>Lessons learned</h2>

<h3>Images and registry</h3>
<div class="tablewrap"><table>
  <tr><th>Problem</th><th>What happened</th><th>Do this</th></tr>
  <tr><td>Short image name</td><td><code>image: state-app:1.0</code> only works on local clusters (minikube, kind). AKS looked on Docker Hub and failed with ImagePullBackOff.</td><td>Use the full path <code>myacrrepo5312.azurecr.io/state-app:TAG</code>.</td></tr>
  <tr><td>ACR not attached</td><td>Pulls failed with 401 Unauthorized even with the right name.</td><td>Run <code>az aks update --attach-acr</code>, check with <code>az aks check-acr</code>.</td></tr>
  <tr><td>ACR Tasks blocked</td><td><code>az acr build</code> failed with <code>TasksOperationsNotAllowed</code> (common on free and student subscriptions).</td><td>Build with Docker locally, then <code>az acr login</code> and <code>docker push</code>.</td></tr>
  <tr><td>Backup manifest applied</td><td>A leftover <code>04-frontend_old.yaml</code> sorted after <code>04-frontend.yaml</code>, so every apply reset the Deployment to the old image and probes. The clue was <code>deployment.apps/frontend</code> printed twice.</td><td>Keep backups out of <code>k8s/</code>. Use git history.</td></tr>
  <tr><td>Reused image tag</td><td>Nodes cache images and <code>IfNotPresent</code> never pulls again, so changed code can run under an old tag.</td><td>Use a new tag for every build.</td></tr>
  <tr><td>Wrong CPU architecture</td><td>AKS nodes are amd64. An image built on ARM fails with <code>exec format error</code>.</td><td>Build on an x86_64 machine.</td></tr>
</table></div>

<h3>Files and workflow</h3>
<div class="tablewrap"><table>
  <tr><th>Problem</th><th>What happened</th><th>Do this</th></tr>
  <tr><td>Stale files in the build</td><td>The new <code>index.html</code> was not in <code>app/public</code>, so the image had the new server and the old page.</td><td>Check with <code>grep -c banner app/public/index.html</code>. Check inside the pod with <code>kubectl -n state-app exec deploy/frontend -- grep -c banner /app/public/index.html</code>. Compare the pod's <code>imageID</code> digest with the one printed by <code>docker push</code>.</td></tr>
  <tr><td>Wrong folder</td><td><code>path ./app not found</code> and <code>path k8s/ does not exist</code>.</td><td>Run commands from the project folder; paths are relative.</td></tr>
  <tr><td>Repeated scripted edit</td><td>A <code>sed</code> that inserts a line added another copy each run, creating duplicate <code>serviceAccountName</code> keys.</td><td>Make edits safe to repeat, and check with <code>grep -n</code> afterwards.</td></tr>
  <tr><td>Docker permission denied</td><td>The user cannot use the Docker socket.</td><td>Use <code>sudo</code>, or add the user to the <code>docker</code> group and log in again.</td></tr>
</table></div>

<h3>Probes and rollouts</h3>
<div class="tablewrap"><table>
  <tr><th>Problem</th><th>What happened</th><th>Do this</th></tr>
  <tr><td>Stuck rollout</td><td>The new pod stayed <code>0/1</code> while two old pods kept the site up.</td><td>A stuck rollout means the new version is broken, not the site. Use <code>rollout status</code> and <code>describe pod</code>.</td></tr>
  <tr><td>Probe path missing</td><td>The manifest probed <code>/livez</code> but the running image was the old build without it, so the probe got 404.</td><td>Ship the code that serves a path before, or together with, the manifest that probes it.</td></tr>
  <tr><td>Liveness tied to the database</td><td>If liveness runs a query, a short database outage restarts every frontend pod.</td><td>Liveness uses a process-only <code>/livez</code>. Readiness checks the database. Add a startup probe for slow first starts.</td></tr>
</table></div>

<h3>Database</h3>
<div class="tablewrap"><table>
  <tr><th>Problem</th><th>What happened</th><th>Do this</th></tr>
  <tr><td>Password change did nothing</td><td>Postgres reads the passwords only when initialising an empty data folder. Editing the Secret later made the app and database disagree.</td><td>Decide passwords before the first deploy. To change later, use <code>ALTER ROLE</code> or delete the data and start fresh.</td></tr>
  <tr><td>Database recreated under a running app</td><td>The app logged <em>schema ready</em>, then failed with <code>relation app_state does not exist</code> while readiness still passed.</td><td>Restart the frontend. Current versions recreate the table by themselves.</td></tr>
  <tr><td>Duplicate key error at startup</td><td>Two frontend pods created the same table at the same moment and one lost the race.</td><td>Harmless. The loser retries and succeeds.</td></tr>
  <tr><td>Data loss</td><td>Deleting a PersistentVolumeClaim deletes the data. Deleting a pod or scaling the StatefulSet does not.</td><td>Delete PVCs only on purpose.</td></tr>
  <tr><td>Replica expectations</td><td>The replica is read-only and there is no failover.</td><td>Only <code>postgres-0</code> accepts writes (see Hardening).</td></tr>
</table></div>

<h3>Access and tooling</h3>
<div class="tablewrap"><table>
  <tr><th>Problem</th><th>What happened</th><th>Do this</th></tr>
  <tr><td>Port-forward failed</td><td>Local port 8080 was already used (Jenkins runs there), and the Service port is 80, not 8080.</td><td><code>kubectl -n state-app port-forward svc/frontend 8081:80</code>, or just use the LoadBalancer IP.</td></tr>
  <tr><td>Page still looks old</td><td>Browsers cache the page.</td><td>Hard refresh (Ctrl+Shift+R) or a private window, and check what the cluster serves with <code>curl</code>.</td></tr>
  <tr><td>Warnings in the output</td><td>Docker says the legacy builder is deprecated. kubectl says v1 Endpoints is deprecated.</td><td>Both are harmless. Installing buildx is optional.</td></tr>
</table></div>
</section>

<section id="hardening">
<h2>Hardening before real use</h2>
<ul>
  <li>Change the placeholder passwords before the first deploy and never commit real ones. Use Azure Key Vault or a sealed secret.</li>
  <li>Stop connecting as the <code>postgres</code> superuser. Create a limited application user.</li>
  <li>Add HTTPS with an ingress controller and a certificate. The LoadBalancer serves plain HTTP on a public IP.</li>
  <li>Add a NetworkPolicy so only the frontend can reach the database pods (network policy must be enabled on the cluster).</li>
  <li>Get automatic failover from a Postgres operator (such as CloudNativePG) or use Azure Database for PostgreSQL Flexible Server, which also gives backups.</li>
  <li>Take backups and test a restore. Replication is not a backup.</li>
  <li>Pin image versions (for example <code>postgres:16.x</code>) and scan images in the ACR.</li>
  <li>Keep the frontend service account read-only (pods <code>get</code> and <code>list</code> only), as in <code>03a-frontend-rbac.yaml</code>.</li>
  <li>Add CPU limits as well as memory limits, and consider a PodDisruptionBudget.</li>
</ul>
</section>

<section id="cleanup">
<h2>Cost control and cleanup</h2>
<pre><code># pause the cluster when not in use
az aks stop --resource-group aks-rg --name aks-cluster
az aks start --resource-group aks-rg --name aks-cluster

# remove the app and its data disks (the cluster stays)
kubectl delete namespace state-app

# remove everything, including the cluster and registry
az group delete --name aks-rg</code></pre>
<p>After a stop and start, check the frontend Service again with <code>kubectl -n state-app get svc frontend</code>, in case the external IP changed.</p>
</section>

<footer>Last updated November 27, 2026.</footer>
</main>
</div>

<script>
  document.querySelectorAll('pre').forEach(function (pre) {
    if (pre.hasAttribute('data-nocopy')) return;
    var code = pre.querySelector('code');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.addEventListener('click', function () {
      var text = code.innerText;
      var done = function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var r = document.createRange();
        r.selectNodeContents(code);
        var s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); done(); } catch (e) {}
        s.removeAllRanges();
      }
    });
    pre.appendChild(btn);
  });
</script>
</body>
</html>
