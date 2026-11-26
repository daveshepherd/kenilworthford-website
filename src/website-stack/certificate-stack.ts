import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
  ICertificate,
} from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  /** The domain the certificate is for, such as dev.kenilworthford.com. */
  domainName: string;
}

/**
 * The website's certificate. CloudFront only uses certificates in us-east-1,
 * so it's a stack of its own there.
 *
 * It's validated by DNS, but the hosted zone is in another account (managed
 * by endor-infrastructure), so CDK can't add the validation record. ACM uses
 * the same record for a domain in an account every time, so endor-infrastructure
 * adds it ahead of the first deploy, and the certificate is issued straight
 * away. Until the record exists, the deploy waits for validation.
 */
export class CertificateStack extends Stack {
  public readonly certificate: ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);
    if (this.region !== 'us-east-1') {
      throw new Error(`CloudFront certificates must be in us-east-1, not ${this.region}`);
    }

    this.certificate = new Certificate(this, 'certificate', {
      domainName: props.domainName,
      validation: CertificateValidation.fromDns(),
    });
  }
}
