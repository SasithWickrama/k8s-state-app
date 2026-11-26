# Persistent switch on Kubernetes

Build the image, then apply the manifests:

    docker build -t state-app:1.0 ./app
    # minikube: minikube image load state-app:1.0   |  kind: kind load docker-image state-app:1.0
    kubectl apply -f k8s/
    kubectl -n state-app get pods -w

Open the app:

    minikube tunnel      # minikube only, then use the EXTERNAL-IP below
    kubectl -n state-app get svc frontend
    # or: kubectl -n state-app port-forward svc/frontend 8080:80

Test persistence:

    kubectl -n state-app delete pod postgres-0 frontend-<id>
    # reload the page: the switch keeps its value

Check replication:

    kubectl -n state-app exec postgres-0 -- psql -U postgres -c "select client_addr,state from pg_stat_replication"
    kubectl -n state-app exec postgres-1 -- psql -U postgres -d appdb -c "select * from app_state"
