import { z } from "zod";
import { MED_SCHEDULES } from "@/lib/schema/medications";
import { GoingSchema } from "@/lib/schema/events";
import { AssigneeSchema } from "@/lib/schema/todos";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What the caregiver confirmed on "Update the circle". Every id is checked against the circle again on the server. */
export const ApplyVisitSchema = z
  .object({
    circleId: z.string().uuid(),
    visitDate: date.optional(),
    clinic: z.string().trim().max(300).optional(),
    meds: z
      .array(
        z.discriminatedUnion("action", [
          z
            .object({
              action: z.literal("add"),
              name: z.string().trim().min(1).max(120),
              detail: z.string().trim().max(500),
              reason: z.string().trim().max(200).optional(),
              dose: z.string().trim().max(80).nullable(),
              schedule: z.enum(MED_SCHEDULES),
            })
            .strict(),
          z.object({ action: z.literal("stop"), medId: z.string().uuid() }).strict(),
          z
            .object({ action: z.literal("update"), medId: z.string().uuid(), detail: z.string().trim().max(500), dose: z.string().trim().max(80).nullable() })
            .strict(),
        ]),
      )
      .max(100),
    todos: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(200),
            dueDate: date.optional(),
            note: z.string().trim().max(1000).optional(),
            assignee: AssigneeSchema,
          })
          .strict(),
      )
      .max(100),
    /** Follow-up appointments from the visit, added to the calendar with who is going. */
    events: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(200),
            date,
            startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
            location: z.string().trim().max(300).optional(),
            going: GoingSchema,
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();
export type ApplyVisitInput = z.infer<typeof ApplyVisitSchema>;
