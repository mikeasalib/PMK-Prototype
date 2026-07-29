import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { PROGRAMS, programById, type ProgramConfig } from "@/lib/program.config";

/**
 * Layout route for a single program.
 *
 * The program id lives in the URL rather than in a module constant, which is
 * what makes one deployment strategist's project a real address they can link
 * to and switch between. Everything below this route reads its program from
 * here, so no page can accidentally render the wrong engagement's data.
 *
 * An unknown id is a 404, deliberately — not a redirect to a default. Serving
 * VA's contract number and stakeholders under /p/typo would be exactly the
 * cross-program leak the model layer was rebuilt to prevent.
 */
export const Route = createFileRoute("/p/$programId")({
  // Validation only. The program object itself is deliberately NOT returned
  // through beforeLoad or a loader: router loader data must be serializable, and
  // a ProgramConfig carries RegExp classifier patterns. Passing it would either
  // fail typecheck or silently ship broken regexes to the client. The id is the
  // only thing that needs to travel; the registry is client-safe, so every
  // consumer resolves the config locally instead.
  beforeLoad: ({ params }) => {
    if (!PROGRAMS[params.programId]) throw notFound();
  },
  component: ProgramLayout,
});

function ProgramLayout() {
  return <Outlet />;
}

/**
 * The program named by the URL. Use this in place of importing PROGRAM, which is
 * only a landing default and does not track what the user is looking at.
 */
export function useProgram(): ProgramConfig {
  const { programId } = Route.useParams();
  return programById(programId);
}
