# Deployment

- Use the repository's integrated CI/CD for deployments.
- Commit the finished changes and push to `main` to trigger the connected Vercel production deployment.
- Verify GitHub CI passes and the production alias serves that exact commit before reporting deployment complete.
- Do not deploy an uncommitted working directory or use a direct `vercel --prod` deployment.
- Run appropriate tests before committing; do not send real messages or alter live trip data during synthetic checks.
