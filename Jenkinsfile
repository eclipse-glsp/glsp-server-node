def kubernetes_config = """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:18
    tty: true
    resources:
      limits:
        memory: "2Gi"
        cpu: "1"
      requests:
        memory: "2Gi"
        cpu: "1"
    command:
    - cat
    volumeMounts:
    - mountPath: "/home/jenkins"
      name: "jenkins-home"
      readOnly: false
    - mountPath: "/.yarn"
      name: "yarn-global"
      readOnly: false
  volumes:
  - name: "jenkins-home"
    emptyDir: {}
  - name: "yarn-global"
    emptyDir: {}
"""

pipeline {
    agent {
        kubernetes {
            label 'glsp-agent-pod'
            yaml kubernetes_config
        }
    }
    options {
        buildDiscarder logRotator(numToKeepStr: '15')
    }
       
    environment {
        YARN_CACHE_FOLDER = "${env.WORKSPACE}/yarn-cache"
        SPAWN_WRAP_SHIM_ROOT = "${env.WORKSPACE}"
        EMAIL_TO= "glsp-build@eclipse.org"
    }
    
    stages {
        stage('Build') {
            steps {
                container('node') {
                    timeout(30){
                        sh "yarn install"
                        script {
                            // Fail the step if there are uncommited changes to the yarn.lock file
                            if (sh(returnStatus: true, script: 'git diff --name-only | grep -q "^yarn.lock"') == 0) {
                                echo 'The yarn.lock file has uncommited changes!'
                                error 'The yarn.lock file has uncommited changes!'
                            } 
                        }
                    }
                }
            }
        }

           stage('Bundle workflow-example (browser)') {
            steps {
                container('node') {
                    timeout(30){
                        dir("examples/workflow-server"){
                            sh "yarn bundle:browser"
                        }                     
                    }
                }
            }
        }

        stage('Codechecks (ESLint)'){
            steps {
                container('node') {
                    timeout(30){
                        sh "yarn lint:ci"                      
                    }
                }
            }
        }

        stage('Tests (Mocha)'){
             steps { 
                container('node') {
                    timeout(30) {
                        sh "yarn test:ci"
                    }
                }
            }
        }

        stage('Test Coverage (main only)') {
            when { branch 'main' }
             steps { 
                container('node') {
                    timeout(30) {
                        sh "yarn test:coverage:ci"
                    }
                }
            }
        }

        stage('Deploy (main only)') {
            when {
                allOf {
                    branch 'main'
                    expression {  
                      /* Only trigger the deployment job if the changeset contains changes in 
                      the `packages` or `examples` directory */
                      sh(returnStatus: true, script: 'git diff --name-only HEAD^ | grep -q "^packages\\|examples"') == 0
                    }
                }
            }
            steps { 
                container('node') {
                    timeout(30) {
                        withCredentials([string(credentialsId: 'npmjs-token', variable: 'NPM_AUTH_TOKEN')]) {
                                sh 'printf "//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n" >> $WORKSPACE/.npmrc'
                        }
                        sh 'git config  user.email "eclipse-glsp-bot@eclipse.org"'
                        sh 'git config  user.name "eclipse-glsp-bot"'
                        sh 'yarn publish:next'
                    }
                }
            }
        }
    }

    post {
        success {
            // Record & publish ESLint issues
            recordIssues enabledForFailure: true, publishAllIssues: true, aggregatingResults: true, 
            tools: [esLint(pattern: './eslint.xml')], 
            qualityGates: [[threshold: 1, type: 'TOTAL', unstable: true]]

            withChecks('Tests') {
                junit 'node_modules/**/report.xml'
            }

            script {
                if (env.BRANCH_NAME == 'main') {
                publishHTML target : [allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'coverage',
                reportFiles: 'index.html',
                reportName: 'Code Coverage']
                }
            }
        }
        failure {
            script {
                if (env.BRANCH_NAME == 'main') {
                    echo "Build result FAILURE: Send email notification to ${EMAIL_TO}"
                    emailext attachLog: true,
                    from: 'glsp-bot@eclipse.org',
                    body: 'Job: ${JOB_NAME}<br>Build Number: ${BUILD_NUMBER}<br>Build URL: ${BUILD_URL}',
                    mimeType: 'text/html', subject: 'Build ${JOB_NAME} (#${BUILD_NUMBER}) FAILURE', to: "${EMAIL_TO}"
                }
            }
        }
        unstable {
            script {
                if (env.BRANCH_NAME == 'main') {
                    echo "Build result UNSTABLE: Send email notification to ${EMAIL_TO}"
                    emailext attachLog: true,
                    from: 'glsp-bot@eclipse.org',
                    body: 'Job: ${JOB_NAME}<br>Build Number: ${BUILD_NUMBER}<br>Build URL: ${BUILD_URL}',
                    mimeType: 'text/html', subject: 'Build ${JOB_NAME} (#${BUILD_NUMBER}) UNSTABLE', to: "${EMAIL_TO}"
                }
            }
        }
        fixed {
            script {
                if (env.BRANCH_NAME == 'main') {
                    echo "Build back to normal: Send email notification to ${EMAIL_TO}"
                    emailext attachLog: false,
                    from: 'glsp-bot@eclipse.org',
                    body: 'Job: ${JOB_NAME}<br>Build Number: ${BUILD_NUMBER}<br>Build URL: ${BUILD_URL}',
                    mimeType: 'text/html', subject: 'Build ${JOB_NAME} back to normal (#${BUILD_NUMBER})', to: "${EMAIL_TO}"
                }
            }
        }
    }
}
