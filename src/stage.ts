export const STAGES = ['local', 'development', 'production'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Reads the deployment stage from the STAGE environment variable.
 *
 * Local synths and CI builds don't set it and get 'local'. The release
 * workflow's deploy jobs set it to 'development' or 'production'. An
 * unrecognised value fails the synth so resources are never mis-tagged.
 */
export function resolveStage(env: NodeJS.ProcessEnv = process.env): Stage {
  const stage = env.STAGE?.trim();
  if (!stage) {
    return 'local';
  }
  if (!(STAGES as readonly string[]).includes(stage)) {
    throw new Error(
      `Unknown STAGE "${stage}". Expected one of: ${STAGES.join(', ')}`,
    );
  }
  return stage as Stage;
}

const API_ENDPOINTS: Record<Stage, string> = {
  local: 'https://api.dev.kenilworthford.com',
  development: 'https://api.dev.kenilworthford.com',
  production: 'https://api.kenilworthford.com',
};

/**
 * The river-levels API the site reads the ford's status and chart from. It's
 * written to each release's config.js, so one build can be deployed to every
 * stage.
 */
export function apiEndpoint(stage: Stage): string {
  return API_ENDPOINTS[stage];
}

export interface SiteDomain {
  /** The domain, such as dev.kenilworthford.com. */
  name: string;
  /**
   * Set while the domain is still on another CloudFront distribution. The
   * distribution gets the certificate but not the domain, so that
   * `aws cloudfront associate-alias` can move the domain to it without a gap.
   * Remove it once the domain has moved.
   */
  pendingMove?: boolean;
}

const SITE_DOMAINS: Record<Stage, SiteDomain | undefined> = {
  local: undefined,
  development: { name: 'dev.kenilworthford.com' },
  // Still on the old distribution in the management account
  production: { name: 'kenilworthford.com', pendingMove: true },
};

/**
 * The domain the stage's distribution serves, if any. The hosted zones are in
 * endor-infrastructure, which holds the certificate's validation record and
 * points the domain at the distribution. A stage without one is only on its
 * CloudFront domain.
 */
export function siteDomain(stage: Stage): SiteDomain | undefined {
  return SITE_DOMAINS[stage];
}
