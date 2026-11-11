import { useTranslations } from "next-intl";

import { useStatusText } from "@/components/demos/instagram/parts";
import type { ItemState } from "@/lib/demos/instagram/state";

function BoardRow({
  item,
  onSelect,
}: {
  item: ItemState;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("demos.instagram");
  const status = useStatusText(item);
  const { analysis } = item;

  return (
    <tr className="border-t border-border-subtle">
      <th scope="row" className="py-3 pe-4 text-start font-normal">
        <button
          type="button"
          onClick={() => {
            onSelect(item.id);
          }}
          className="inline-flex min-h-11 items-center text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
        >
          {item.handle}
        </button>
      </th>
      <td className="py-3 pe-4 font-mono text-text">
        {analysis?.score !== null && analysis?.score !== undefined
          ? t("detail.scoreOf", { score: analysis.score })
          : ""}
        {analysis?.bucket ? (
          <span className="ms-2 font-sans text-sm text-text-secondary">
            {t(`bucket.${analysis.bucket}`)}
          </span>
        ) : null}
      </td>
      <td className="py-3 text-text-secondary">{status}</td>
    </tr>
  );
}

/**
 * The lead scoring board: the analysed sales contacts, best score first, with
 * where each stands. A real table (headers, a caption), so it reads well in a
 * screen reader and on a phone.
 */
export function LeadBoard({
  items,
  onSelect,
}: {
  items: readonly ItemState[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("demos.instagram.board");
  const leads = items
    .filter((item) => item.analysis?.category === "lead")
    .sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0));

  return (
    <section
      aria-labelledby="ig-board-title"
      className="grid grid-cols-1 gap-4"
    >
      <h3 id="ig-board-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      {leads.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-96 text-start text-base">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="text-sm text-text-muted">
                <th scope="col" className="pe-4 pb-2 text-start font-normal">
                  {t("handle")}
                </th>
                <th scope="col" className="pe-4 pb-2 text-start font-normal">
                  {t("score")}
                </th>
                <th scope="col" className="pb-2 text-start font-normal">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((item) => (
                <BoardRow key={item.id} item={item} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-base text-text-muted">{t("empty")}</p>
      )}
    </section>
  );
}
