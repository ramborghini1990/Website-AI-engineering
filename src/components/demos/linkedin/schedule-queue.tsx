import { useTranslations } from "next-intl";

import { slotInfo, type ItemState } from "@/lib/demos/linkedin/state";

/**
 * What the person approved and when it WOULD go out. A message appears here
 * only after an approval; the table is empty until then. A real table (headers,
 * a caption), so it reads well in a screen reader and on a phone.
 */
export function ScheduleQueue({
  items,
  onSelect,
}: {
  items: readonly ItemState[];
  onSelect: (id: ItemState["id"]) => void;
}) {
  const t = useTranslations("demos.linkedin");

  return (
    <section
      aria-labelledby="li-queue-title"
      className="grid grid-cols-1 gap-4"
    >
      <h3 id="li-queue-title" className="text-2xl text-text">
        {t("queue.title")}
      </h3>
      {items.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-96 text-start text-base">
            <caption className="sr-only">{t("queue.caption")}</caption>
            <thead>
              <tr className="text-sm text-text-muted">
                <th scope="col" className="pe-4 pb-2 text-start font-normal">
                  {t("queue.prospect")}
                </th>
                <th scope="col" className="pb-2 text-start font-normal">
                  {t("queue.when")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const { day, time } = slotInfo(item.slot ?? 1);
                return (
                  <tr key={item.id} className="border-t border-border-subtle">
                    <th
                      scope="row"
                      className="py-3 pe-4 text-start font-normal"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.id);
                        }}
                        className="inline-flex min-h-11 items-center text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                      >
                        {t(`items.${item.id}.name`)}
                      </button>
                    </th>
                    <td className="py-3 text-text-secondary">
                      {t("queue.slot", { day, time })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-base text-text-muted">{t("queue.empty")}</p>
      )}
      <p className="max-w-3xl text-sm text-text-muted">{t("queue.note")}</p>
    </section>
  );
}
