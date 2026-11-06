import { describe, expect, it } from "vitest";
import { dataEnv, deploymentSetting } from "@/lib/data-env";

const prod = {
  SUPABASE_URL: "https://prod.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "prod-anon",
  SUPABASE_SERVICE_ROLE_KEY: "prod-service",
  HELPER_SESSION_SECRET: "prod-helper",
};

describe("which database a deployment may use", () => {
  it("production and local development use the normal settings", () => {
    expect(dataEnv({ ...prod, VERCEL_ENV: "production" }).supabaseUrl).toBe("https://prod.supabase.co");
    expect(deploymentSetting("SUPABASE_SERVICE_ROLE_KEY", prod)).toBe("prod-service");
  });

  it("a preview build never uses production settings, even when they are present", () => {
    const source = { ...prod, VERCEL_ENV: "preview" };
    expect(dataEnv(source)).toMatchObject({ preview: true, supabaseUrl: "", anonKey: "" });
    expect(deploymentSetting("SUPABASE_SERVICE_ROLE_KEY", source)).toBe("");
    expect(deploymentSetting("HELPER_SESSION_SECRET", source)).toBe("");
  });

  it("a preview build can use a separate test project", () => {
    const source = {
      ...prod,
      VERCEL_ENV: "preview",
      PREVIEW_SUPABASE_URL: "https://test.supabase.co",
      PREVIEW_SUPABASE_ANON_KEY: "test-anon",
      PREVIEW_SUPABASE_SERVICE_ROLE_KEY: "test-service",
      PREVIEW_HELPER_SESSION_SECRET: "test-helper",
    };
    expect(dataEnv(source)).toMatchObject({ supabaseUrl: "https://test.supabase.co", anonKey: "test-anon" });
    expect(deploymentSetting("SUPABASE_SERVICE_ROLE_KEY", source)).toBe("test-service");
    expect(deploymentSetting("HELPER_SESSION_SECRET", source)).toBe("test-helper");
  });
});
