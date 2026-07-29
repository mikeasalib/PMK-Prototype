import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_PROGRAM_ID } from "@/lib/program.config";

/**
 * The bare root has no program, so it cannot render anything truthful. Redirect
 * to the default program rather than picking one implicitly and showing it under
 * a URL that does not say which engagement you are looking at.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/p/$programId",
      params: { programId: DEFAULT_PROGRAM_ID },
      replace: true,
    });
  },
});
