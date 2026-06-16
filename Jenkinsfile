pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'ct-access'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Deploy Backend + Frontend') {
            steps {
                sh '''
                    docker compose down || true
                    docker compose up -d --build
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    docker compose ps
                    echo "--- Backend ---"
                    curl -sf http://localhost:9801/api/health || echo "Backend health check failed"
                    echo "--- Frontend ---"
                    curl -sf -o /dev/null -w "HTTP %{http_code}\\n" http://localhost:9800/ || echo "Frontend health check failed"
                '''
            }
        }

        stage('Cleanup Images') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        failure {
            sh 'docker compose logs --tail=80 || true'
        }
        success {
            echo 'Deployed: UI http://<server>:9800  |  API http://<server>:9801/docs'
        }
    }
}
