variable "aws_region" {
  description = "AWS region for the S3 bucket. CloudFront is global regardless."
  type        = string
  default     = "us-east-1"
}

variable "bucket_prefix" {
  description = "Prefix for the bucket + role names. A random suffix is appended to the bucket."
  type        = string
  default     = "blue-eclipse-quiz"
}

variable "github_repo" {
  description = "owner/repo allowed to assume the deploy role via OIDC."
  type        = string
  default     = "DoboVlad/angular_interview"
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if one already exists in this account."
  type        = bool
  default     = true
}
