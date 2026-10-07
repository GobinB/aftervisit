/**
 * Public-demo mode: on unless NEXT_PUBLIC_DEMO_MODE=false. While on, the site asks people
 * to use the sample or made-up information instead of real patient records.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export const DEMO_NOTICE =
  "AfterVisit is a public prototype. Please use the sample visit or made-up information. Do not upload real patient records until AfterVisit has completed a privacy and security review.";
