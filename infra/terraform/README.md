# Infrastructure (Terraform) — beginner's guide

This provisions everything your app needs on AWS in one command: a private S3
bucket, a CloudFront CDN with **free HTTPS**, and the IAM role your GitHub
Actions pipeline assumes to deploy. You run it **once**; after that, every
`git push` to `main` redeploys automatically.

> You will run a few commands on your own machine. **Never share AWS access keys
> with anyone** (including in chat). Nothing here asks you to.

Total time: ~30–40 min, most of it waiting for CloudFront to finish creating.

---

## Step 1 — Create an AWS account

1. Go to <https://aws.amazon.com/> → **Create an AWS Account**.
2. You'll need an email, a password, and a **credit/debit card** (AWS requires
   one even on the free tier — this project costs roughly **$0–1/month** at
   personal traffic; see [Costs](#costs)).
3. Choose the **Basic (free)** support plan.

## Step 2 — Create credentials for Terraform

Terraform needs permission to create things. The simplest beginner path is a
dedicated admin user:

1. Sign in to the [AWS Console](https://console.aws.amazon.com/) as the account
   you just made.
2. Search for **IAM** → **Users** → **Create user**.
   - User name: `terraform-admin`
   - **Do not** enable console access (this is for CLI only).
3. **Set permissions** → *Attach policies directly* → check
   **AdministratorAccess** → Create user.
4. Open the new user → **Security credentials** tab → **Create access key** →
   choose **Command Line Interface (CLI)** → confirm → **Create access key**.
5. Copy the **Access key ID** and **Secret access key**. You'll paste them once
   in Step 4. (You can't see the secret again — but you can always make a new one.)

> When you're fully done and the pipeline works, you can delete this access key
> for safety; the pipeline itself doesn't use it (it uses OIDC).

## Step 3 — Install the tools (Windows)

Open **PowerShell** and install both tools. Easiest with
[winget](https://learn.microsoft.com/windows/package-manager/winget/) (built into
Windows 11):

```powershell
winget install Amazon.AWSCLI
winget install HashiCorp.Terraform
```

Close and reopen PowerShell, then verify:

```powershell
aws --version
terraform -version
```

(No winget? Download the AWS CLI MSI from
<https://aws.amazon.com/cli/> and Terraform from
<https://developer.hashicorp.com/terraform/install>.)

## Step 4 — Connect the AWS CLI to your account

```powershell
aws configure
```

Paste your **Access key ID** and **Secret access key** from Step 2. For the
other two prompts:

- **Default region name**: `us-east-1` (or your preferred region)
- **Default output format**: just press Enter

Verify it works:

```powershell
aws sts get-caller-identity
```

You should see your account number — that means Terraform can authenticate too.

## Step 5 — Run Terraform

In PowerShell, go to this folder and apply:

```powershell
cd C:\Users\dobov\angular_interview_questions\infra\terraform
terraform init
terraform apply
```

- `terraform apply` shows a plan of ~10 resources and asks to confirm.
  Type **`yes`** and press Enter.
- It runs for a few minutes (CloudFront is the slow part — up to ~15 min while
  it propagates to edge locations; the command waits for it).

Want a non-default region or names? Pass variables, e.g.:

```powershell
terraform apply -var="aws_region=eu-west-1"
```

(Available variables: `aws_region`, `bucket_prefix`, `github_repo`,
`create_oidc_provider` — see [variables.tf](variables.tf).)

## Step 6 — Put the outputs into GitHub

When `apply` finishes it prints a **`github_actions_setup`** block. Open it any
time with:

```powershell
terraform output github_actions_setup
```

In your repo on GitHub: **Settings → Secrets and variables → Actions**:

- **Secrets** tab → New repository secret:
  - `AWS_ROLE_ARN` = the role ARN from the output
- **Variables** tab → New repository variable (one each):
  - `AWS_REGION`
  - `S3_BUCKET`
  - `CLOUDFRONT_DIST_ID`

## Step 7 — Deploy

Trigger the pipeline by pushing any commit to `main` (or go to the **Actions**
tab → the workflow → **Run workflow**):

```powershell
git commit --allow-empty -m "Trigger first deploy"
git push
```

Watch it in the **Actions** tab. When the `Deploy to S3` job goes green, open
your site:

```powershell
terraform output site_url
```

That `https://xxxxxxxx.cloudfront.net` URL is your live app. 🎉

---

## Costs

For a personal project this lands in or near the **free tier**:

- **S3**: pennies for storage (the build is < 1 MB) + tiny request costs.
- **CloudFront**: 1 TB/month data transfer + 10M requests are free on the
  perpetual free tier; you won't approach that.
- **IAM / OIDC**: free.

Realistically **$0–1/month**. Set a billing alarm (AWS Console → Billing →
Budgets) if you want peace of mind.

## Updating the site later

Just push to `main`. The pipeline rebuilds, syncs to S3, and invalidates
CloudFront so changes appear within seconds.

## Tearing it all down

To remove everything and stop any charges:

```powershell
terraform destroy
```

(The S3 bucket must be empty for destroy to succeed. If it errors, empty it
first: `aws s3 rm s3://YOUR_BUCKET --recursive`, then re-run destroy.)

## Troubleshooting

- **`EntityAlreadyExists` for the OIDC provider** — your account already has the
  GitHub OIDC provider. Re-run with `terraform apply -var="create_oidc_provider=false"`
  and Terraform will reuse the existing one.
- **Deploy job fails at "Configure AWS credentials"** — the `AWS_ROLE_ARN` secret
  is missing/typo'd, or the repo in `github_repo` doesn't match `DoboVlad/angular_interview`.
- **Site shows AccessDenied / blank** — the bucket is still empty; run the deploy
  (Step 7). CloudFront can also take a few minutes the very first time.
- **403 on a deep link like `/browse`** — expected to resolve to the app; the
  distribution maps 403/404 → `/index.html`. Give CloudFront a moment after first
  deploy, then hard-refresh.
```
