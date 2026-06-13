###############################################################################
# Blue Eclipse — AWS infrastructure
#
# Provisions, in one `terraform apply`:
#   • a private S3 bucket (not publicly readable)
#   • a CloudFront distribution serving it over HTTPS (free *.cloudfront.net cert)
#       - SPA routing: 403/404 -> /index.html (200)
#   • Origin Access Control so only CloudFront can read the bucket
#   • a GitHub OIDC provider + a least-privilege IAM role the CI pipeline assumes
#
# Outputs feed directly into the GitHub repo's Actions secrets/variables.
###############################################################################

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  # S3 bucket names must be globally unique — a random suffix guarantees it.
  bucket_name = "${var.bucket_prefix}-${random_id.suffix.hex}"
}

# ---------------------------------------------------------------------------
# S3 bucket (private — served only through CloudFront)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "site" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# CloudFront + Origin Access Control
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${local.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "Blue Eclipse quiz"
  price_class         = "PriceClass_100" # cheapest: NA + EU edges

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy  = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS-managed "CachingOptimized" policy.
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA deep links: serve index.html for client-side routes.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true # free HTTPS on *.cloudfront.net
  }
}

# Bucket policy: only this CloudFront distribution may read objects.
data "aws_iam_policy_document" "bucket" {
  statement {
    sid     = "AllowCloudFrontRead"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket.json
}

# ---------------------------------------------------------------------------
# GitHub OIDC provider + deploy role
# ---------------------------------------------------------------------------
# Create the provider once per AWS account. If it already exists, set
# create_oidc_provider = false and Terraform will look up the existing one.
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  # try() guards each branch so the unused one (count = 0) never index-errors,
  # regardless of Terraform's conditional-evaluation version quirks.
  oidc_provider_arn = coalesce(
    try(aws_iam_openid_connect_provider.github[0].arn, null),
    try(data.aws_iam_openid_connect_provider.github[0].arn, null),
  )
}

# Trust policy: only GitHub Actions runs on this repo may assume the role.
data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.bucket_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

# Least-privilege: sync to this bucket + invalidate this distribution only.
data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "WriteObjects"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "InvalidateCache"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}

# ---------------------------------------------------------------------------
# Billing safety net (opt-in)
#
# Created only when budget_alert_email is set. Emails you at 80% of the monthly
# threshold (actual spend) and again if forecast spend will exceed 100%.
# AWS Budgets is free for the first two budgets per account.
# ---------------------------------------------------------------------------
resource "aws_budgets_budget" "monthly" {
  count        = var.budget_alert_email != "" ? 1 : 0
  name         = "${var.bucket_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Notify when actual spend passes 80% of the threshold.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  # Notify when forecast spend is projected to exceed the threshold.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
