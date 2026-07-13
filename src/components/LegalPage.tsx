import { useLanguage } from "../i18n/LanguageContext";

type LegalPageProps = {
  type: "privasi" | "syarat" | "refund";
};

function PrivacyContent() {
  const { t } = useLanguage();
  const p = t.legal.privacy;

  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">{p.title}</h1>
      <p className="mb-8 text-sm text-neutral-500">{p.lastUpdated}</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-700">
        <p>{p.intro}</p>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s1.heading}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {p.s1.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s2.heading}</h2>
          <p>{p.s2.intro}</p>
          <ul className="list-disc space-y-1 pl-5">
            {p.s2.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2">
            {p.s2.noteBefore} <strong className="text-neutral-900">{p.s2.noteBold}</strong> {p.s2.noteAfter}
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s3.heading}</h2>
          <p>{p.s3.intro}</p>
          <ul className="list-disc space-y-1 pl-5">
            {p.s3.items.map((item) => (
              <li key={item.label}>
                <strong className="text-neutral-900">{item.label}</strong> {item.text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s4.heading}</h2>
          <p>{p.s4.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s5.heading}</h2>
          <p>{p.s5.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s6.heading}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {p.s6.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s7.heading}</h2>
          <p>{p.s7.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s8.heading}</h2>
          <p>{p.s8.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s9.heading}</h2>
          <p>{p.s9.text}</p>
        </div>
      </div>
    </>
  );
}

function TermsContent() {
  const { t } = useLanguage();
  const p = t.legal.terms;

  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">{p.title}</h1>
      <p className="mb-8 text-sm text-neutral-500">{p.lastUpdated}</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-700">
        <p>{p.intro}</p>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s1.heading}</h2>
          <p>
            {p.s1.before} <strong className="text-neutral-900">{p.s1.bold}</strong>
            {p.s1.after}
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s2.heading}</h2>
          <p>{p.s2.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s3.heading}</h2>
          <p>{p.s3.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s4.heading}</h2>
          <p>{p.s4.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s5.heading}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {p.s5.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s6.heading}</h2>
          <p>{p.s6.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s7.heading}</h2>
          <p>{p.s7.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s8.heading}</h2>
          <p>{p.s8.text}</p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.s9.heading}</h2>
          <p>{p.s9.text}</p>
        </div>
      </div>
    </>
  );
}

function RefundContent() {
  const { t } = useLanguage();
  const p = t.legal.refund;

  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">{p.title}</h1>
      <p className="mb-8 text-sm text-neutral-500">{p.lastUpdated}</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-700">
        <p>{p.intro}</p>

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-3 font-semibold text-neutral-900">{p.tableHeaders.situation}</th>
                <th className="p-3 font-semibold text-neutral-900">{p.tableHeaders.eligible}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {p.rows.map((row) => (
                <tr key={row.situation}>
                  <td className="p-3">{row.situation}</td>
                  <td className={"p-3 " + (row.highlighted ? "text-primary" : "text-neutral-600")}>
                    {row.eligible}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-neutral-900">{p.howToTitle}</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {p.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

function LegalPage({ type }: LegalPageProps) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      {type === "privasi" && <PrivacyContent />}
      {type === "syarat" && <TermsContent />}
      {type === "refund" && <RefundContent />}
    </section>
  );
}

export default LegalPage;
