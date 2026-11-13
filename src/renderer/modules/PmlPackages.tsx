'use client';

import React from 'react';
import { ArrowRight, Check, Package as PackageIcon, ShieldCheck } from 'lucide-react';

import { useSiteInteractions } from '../SiteInteractionContext';
// Render-time-only use (inside the component), so this import cycle with PmlRenderer is safe.
import { ForceMobileContext } from '../PmlRenderer';
import { ACCENT_BUTTON } from '../../pml/primitiveStyle';

/**
 * The packages module, rendered from the snapshot the publish (and builder-preview) pipeline
 * bakes into the primitive as `resolved_packages`. This is the ONE way onto a consultant's
 * books: choosing a package starts the intake, because a package carries the price, the scope,
 * the agreement, and the journey that a bare "book a call" does not.
 *
 * Interactivity comes from the funnel, not from this component: `startIntake` is provided on
 * the public page and ABSENT in the builder, so the card's button is live in one place and
 * honestly disabled in the other, with no preview flag to forget. This is the PML equivalent
 * of the retired PackagesBlock, kept identical in behaviour.
 */

interface ResolvedPackage {
  id: string | number;
  name: string;
  description?: string | null;
  base_price?: string | number | null;
  currency?: string | null;
  deliverables?: string[];
  requires_approval?: boolean;
}

function formatPrice(amount: unknown, currency: string | null | undefined): string | null {
  const value = typeof amount === 'string' ? Number(amount) : typeof amount === 'number' ? amount : NaN;

  if (!Number.isFinite(value)) return null;
  if (value === 0) return 'No fee';

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency || 'CAD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * The packages grid's column classes, adapted to how many packages there are (a lone package should
 * not stretch into a giant full-width card; two should not leave a hole where a third would be), and
 * collapsed to a single column in the builder's Mobile-view preview.
 */
export function packageGridCols(count: number, forceMobile: boolean): string {
  if (forceMobile || count <= 1) return count === 1 ? 'mx-auto max-w-md' : '';
  if (count === 2) return 'md:grid-cols-2';

  return 'md:grid-cols-2 lg:grid-cols-3';
}

export function PmlPackages({ props }: { props: Record<string, unknown> }): React.JSX.Element {
  const { startIntake } = useSiteInteractions();
  const forceMobile = React.useContext(ForceMobileContext);
  const packages = Array.isArray(props.resolved_packages)
    ? (props.resolved_packages as ResolvedPackage[])
    : [];
  const heading = typeof props.heading === 'string' ? props.heading : '';
  const intro = typeof props.intro === 'string' ? props.intro : '';
  // No handler => the builder. Say what WILL happen rather than rendering an empty band.
  const editing = typeof startIntake !== 'function';

  if (packages.length === 0) {
    return (
      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-3xl rounded-[var(--site-radius)] border border-dashed border-current/25 px-6 py-10 text-center">
          <PackageIcon className="mx-auto mb-3 h-7 w-7 opacity-40" />
          <p className="text-sm opacity-70">
            {editing
              ? 'Your public packages will appear here. Mark a package public from the Packages tab of your Library, and it will show up when you publish.'
              : 'No packages are available right now.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        {heading ? (
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">{heading}</h2>
        ) : null}
        {intro ? (
          <p className="mx-auto mt-3 max-w-2xl text-center leading-relaxed opacity-80">{intro}</p>
        ) : null}

        <div className={`mt-10 grid grid-cols-1 gap-6 ${packageGridCols(packages.length, forceMobile)}`.trim()}>
          {packages.map((pkg) => {
            const price = formatPrice(pkg.base_price, pkg.currency);

            return (
              <div
                key={String(pkg.id)}
                className="flex flex-col rounded-[var(--site-radius)] border border-current/10 bg-[var(--site-surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{pkg.name}</h3>

                {price ? (
                  <p className="mt-1 text-2xl font-semibold text-[var(--site-accent)]">{price}</p>
                ) : null}

                {pkg.description ? (
                  <p className="mt-3 flex-1 text-sm leading-relaxed opacity-80">{pkg.description}</p>
                ) : (
                  <div className="flex-1" />
                )}

                {pkg.deliverables && pkg.deliverables.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {pkg.deliverables.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" />
                        <span className="opacity-85">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  disabled={!startIntake}
                  onClick={() => startIntake?.(String(pkg.id))}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--site-button-radius,9999px)] px-5 py-2.5 font-medium outline-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ACCENT_BUTTON}`}
                >
                  {/* The label tells the truth about what happens next: a package needing the
                      consultant's approval says so, not "Get started". */}
                  {pkg.requires_approval ? 'Request this' : 'Get started'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                {pkg.requires_approval ? (
                  <p className="mt-2 text-center text-xs opacity-60">
                    This consultant reviews requests before taking on the work.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs opacity-60">
          <ShieldCheck className="h-3.5 w-3.5" />
          Fees are for professional services. No immigration outcome can be guaranteed, and
          government fees are separate.
        </p>
      </div>
    </section>
  );
}
