# Deploy to AWS App Runner

1. Create an ECR repository for `pawpatrol`.
2. Log in to ECR with the AWS CLI:
   `aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com`
3. Build from the repository root: `docker build -f backend/Dockerfile -t pawpatrol .`
4. Tag the image: `docker tag pawpatrol:latest <account-id>.dkr.ecr.<region>.amazonaws.com/pawpatrol:<tag>`
5. Push it: `docker push <account-id>.dkr.ecr.<region>.amazonaws.com/pawpatrol:<tag>`
6. Create an App Runner service from that ECR image. Set the port to `8000` and the health check path to `/api/health`.
7. Add the environment variables from `.env.example` in App Runner; never put keys or credentials in the image.
8. Open the service URL and confirm the website and `/api/health` are available.
9. To roll back, redeploy the previous image tag.

`backend/data` and `backend/uploads` live on the container disk and reset on every redeploy. Accounts, requests, and photos created on the server are therefore lost on redeploy.
