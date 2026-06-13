output "site_url" {
  description = "Your live HTTPS site URL."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "s3_bucket" {
  description = "Set as GitHub Actions VARIABLE: S3_BUCKET"
  value       = aws_s3_bucket.site.id
}

output "cloudfront_dist_id" {
  description = "Set as GitHub Actions VARIABLE: CLOUDFRONT_DIST_ID"
  value       = aws_cloudfront_distribution.site.id
}

output "aws_region" {
  description = "Set as GitHub Actions VARIABLE: AWS_REGION"
  value       = var.aws_region
}

output "deploy_role_arn" {
  description = "Set as GitHub Actions SECRET: AWS_ROLE_ARN"
  value       = aws_iam_role.deploy.arn
}

output "budget_alarm" {
  description = "Whether the monthly billing alarm is active."
  value = length(aws_budgets_budget.monthly) > 0 ? "enabled: alerts ${var.budget_alert_email} at 80%/100% of $${var.monthly_budget_usd}/mo" : "disabled (set budget_alert_email to enable)"
}

# One-glance summary of everything to paste into GitHub repo settings.
output "github_actions_setup" {
  description = "Copy these into Settings -> Secrets and variables -> Actions."
  value = <<-EOT

    GitHub repo → Settings → Secrets and variables → Actions

    Secrets:
      AWS_ROLE_ARN        = ${aws_iam_role.deploy.arn}

    Variables:
      AWS_REGION          = ${var.aws_region}
      S3_BUCKET           = ${aws_s3_bucket.site.id}
      CLOUDFRONT_DIST_ID  = ${aws_cloudfront_distribution.site.id}

    Then push to main — the pipeline deploys to:
      https://${aws_cloudfront_distribution.site.domain_name}
  EOT
}
