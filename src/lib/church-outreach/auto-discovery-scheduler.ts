/**
 * Auto-Discovery Scheduler — Daily automated church discovery
 *
 * Runs at a configured UTC hour each day:
 * 1. Google Places search for churches across the US
 * 2. Filter out already-imported churches
 * 3. Scrape websites
 * 4. AI research
 * 5. Auto-import churches above fit score threshold
 * 6. Auto-enroll in configured drip sequence
 */

import cron from 'node-cron';

let initialized = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoDiscoveryConfig {
  enabled: boolean;
  search_filters: string;           // optional search terms (e.g. "baptist", "youth ministry")
  min_fit_score: number;
  max_per_run: number;
  auto_enroll_sequence_id: number | null;
  run_at_hour_utc: number;
  // Legacy fields (kept for backward compat with saved configs)
  target_locations?: string[];
  radius_miles?: number;
}

const DEFAULT_CONFIG: AutoDiscoveryConfig = {
  enabled: false,
  search_filters: '',
  min_fit_score: 8,
  max_per_run: 20,
  auto_enroll_sequence_id: null,
  run_at_hour_utc: 6,
};

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export async function getAutoDiscoveryConfig(): Promise<AutoDiscoveryConfig> {
  const { PlatformSetting } = await import('@/lib/db/models');
  const raw = await PlatformSetting.get('outreach_auto_discovery_config');
  if (!raw) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setAutoDiscoveryConfig(config: Partial<AutoDiscoveryConfig>): Promise<void> {
  const { PlatformSetting } = await import('@/lib/db/models');
  const current = await getAutoDiscoveryConfig();
  const merged = { ...current, ...config };
  await PlatformSetting.set('outreach_auto_discovery_config', JSON.stringify(merged));
}

// ---------------------------------------------------------------------------
// Core discovery logic
// ---------------------------------------------------------------------------

const SCRAPE_CONCURRENCY = 3;

export interface DiscoveryProgress {
  phase: string;        // e.g. 'searching', 'scraping', 'researching', 'importing', 'complete'
  message: string;      // human-readable status
  current: number;      // current item index
  total: number;        // total items to process
  stats: { discovered: number; imported: number; enrolled: number; errors: number };
}

export type ProgressCallback = (progress: DiscoveryProgress) => void;

export async function runAutoDiscovery(onProgress?: ProgressCallback): Promise<{
  discovered: number;
  imported: number;
  enrolled: number;
  errors: number;
}> {
  const config = await getAutoDiscoveryConfig();
  const stats = { discovered: 0, imported: 0, enrolled: 0, errors: 0 };

  const emit = (phase: string, message: string, current = 0, total = 0) => {
    onProgress?.({ phase, message, current, total, stats: { ...stats } });
  };

  if (!config.enabled) {
    emit('error', 'Auto-discovery is not enabled');
    console.log('[Auto-Discovery] Disabled');
    return stats;
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    emit('error', 'GOOGLE_PLACES_API_KEY not configured');
    console.warn('[Auto-Discovery] GOOGLE_PLACES_API_KEY not configured, skipping');
    return stats;
  }

  const { searchChurches } = await import('./google-places');
  const { scrapeChurchWebsite } = await import('./scraper');
  const { researchChurch } = await import('./ai-researcher');
  const { Church, ChurchActivity, DripEnrollment, DripStep, OutreachEmail, OutreachTemplate } = await import('@/lib/db/models');
  const { Op } = await import('sequelize');
  const { renderTemplate, renderSubject } = await import('./template-renderer');

  try {
    emit('searching', `Searching for churches across the US${config.search_filters ? ` (${config.search_filters})` : ''}...`);

    const results = await searchChurches({
      filters: config.search_filters || undefined,
      maxResults: Math.min(60, config.max_per_run + 10),
    });

    stats.discovered += results.length;
    emit('filtering', `Found ${results.length} churches, filtering duplicates...`);

    // Filter out already imported churches
    const placeIds = results.map((r) => r.placeId).filter(Boolean);
    let importedPlaceIds = new Set<string>();

    if (placeIds.length > 0) {
      const existing = await Church.findAll({
        where: { google_place_id: { [Op.in]: placeIds } },
        attributes: ['google_place_id'],
      });
      importedPlaceIds = new Set(
        existing.map((c) => c.google_place_id).filter((id): id is string => id !== null)
      );
    }

    const newResults = results.filter(
      (r) => r.placeId && !importedPlaceIds.has(r.placeId)
    );

    emit('filtering', `${newResults.length} new churches to process (${importedPlaceIds.size} already imported)`);

    let totalImported = 0;

    // Scrape + research in batches
    for (let i = 0; i < newResults.length && totalImported < config.max_per_run; i += SCRAPE_CONCURRENCY) {
      const batch = newResults.slice(i, i + SCRAPE_CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async (place, batchIdx) => {
          const churchNum = i + batchIdx + 1;
          try {
            let scrapedData = null;
            let researchResult = null;

            if (place.website) {
              emit('scraping', `Scraping website for ${place.name}...`, churchNum, newResults.length);
              scrapedData = await scrapeChurchWebsite(place.website);
            }

            if (scrapedData) {
              emit('researching', `AI researching ${place.name}...`, churchNum, newResults.length);
              researchResult = await researchChurch(scrapedData, place);
            }

            return { place, scrapedData, researchResult };
          } catch (err) {
            console.warn(`[Auto-Discovery] Error processing ${place.name}:`, err);
            stats.errors++;
            return { place, scrapedData: null, researchResult: null };
          }
        })
      );

      for (const { place, scrapedData, researchResult } of batchResults) {
        if (totalImported >= config.max_per_run) break;

        // Check fit score threshold
        const fitScore = researchResult?.outreach_fit_score ?? 5;
        if (fitScore < config.min_fit_score) {
          emit('skipped', `Skipped ${place.name} (fit score ${fitScore}/${config.min_fit_score} required)`, i + 1, newResults.length);
          continue;
        }

        try {
          emit('importing', `Importing ${place.name} (fit score ${fitScore}/10)...`, stats.imported + 1, newResults.length);

          // Extract address components
          const addressParts = place.address.split(', ');
          const stateZip = addressParts.length >= 3 ? addressParts[addressParts.length - 2] : '';
          const [state, zipCode] = stateZip.split(' ');

          // Import the church
          const church = await Church.create({
            google_place_id: place.placeId,
            name: place.name,
            website_url: place.website,
            contact_phone: researchResult?.contact_phone || place.phone,
            contact_email: researchResult?.contact_email || scrapedData?.emails[0] || null,
            address_line1: addressParts[0] || null,
            city: addressParts.length >= 3 ? addressParts[addressParts.length - 3] : null,
            state: state || null,
            zip_code: zipCode || null,
            latitude: place.lat,
            longitude: place.lng,
            source: 'google_places',
            pipeline_stage: 'new_lead',
            pastor_name: researchResult?.pastor_name || null,
            staff_names: researchResult?.staff_members?.map((s) => `${s.name} (${s.role})`) || null,
            denomination: researchResult?.denomination || null,
            congregation_size_estimate: researchResult?.congregation_size_estimate || null,
            youth_programs: researchResult?.youth_programs || null,
            service_times: researchResult?.service_times || null,
            social_media: researchResult?.social_media || scrapedData?.socialMedia || null,
            ai_summary: researchResult?.summary || null,
            outreach_fit_score: fitScore,
            outreach_fit_reason: researchResult?.outreach_fit_reason || null,
            has_youth_ministry: researchResult?.has_youth_ministry || false,
            has_young_adult_ministry: researchResult?.has_young_adult_ministry || false,
            has_small_groups: researchResult?.has_small_groups || false,
            has_missions_focus: researchResult?.has_missions_focus || false,
          });

          // Log activities
          await ChurchActivity.create({
            church_id: church.id,
            activity_type: 'auto_discovered',
            description: `Auto-discovered via US-wide search${config.search_filters ? ` (${config.search_filters})` : ''}`,
            metadata: { filters: config.search_filters, fit_score: fitScore },
          });

          await ChurchActivity.create({
            church_id: church.id,
            activity_type: 'auto_imported',
            description: `Auto-imported with fit score ${fitScore}/10`,
            metadata: { source: 'auto_discovery' },
          });

          stats.imported++;
          totalImported++;

          // Generate outreach email for review queue if church has contact email
          if (church.contact_email) {
            emit('email', `Generating outreach email for ${church.name}...`, stats.imported, newResults.length);
            try {
              const defaultTemplate = await OutreachTemplate.findOne({ where: { is_default: true } });
              if (defaultTemplate) {
                const assets = typeof defaultTemplate.template_assets === 'string'
                  ? JSON.parse(defaultTemplate.template_assets)
                  : defaultTemplate.template_assets || {};
                const renderedHtml = renderTemplate(defaultTemplate.html_body, church, assets);
                const renderedSubject = renderSubject(defaultTemplate.subject, church);

                // Generate AI-personalized version if available
                let aiHtml = null;
                let aiSubject = null;
                try {
                  const { generatePersonalizedEmail } = await import('./ai-email-writer');
                  const personalized = await generatePersonalizedEmail(
                    church,
                    renderedSubject,
                    renderedHtml,
                    { stepOrder: 1, totalSteps: 1, sequenceName: 'Auto-Discovery' },
                    assets,
                  );
                  aiHtml = personalized.html;
                  aiSubject = personalized.subject;
                } catch {
                  // AI personalization optional — fall back to rendered template
                }

                await OutreachEmail.create({
                  church_id: church.id,
                  template_id: defaultTemplate.id,
                  to_email: church.contact_email,
                  subject: aiSubject || renderedSubject,
                  rendered_html: renderedHtml,
                  ai_html: aiHtml,
                  status: 'pending_review',
                  tracking_id: crypto.randomUUID(),
                });
              }
            } catch (emailErr) {
              console.warn(`[Auto-Discovery] Error generating email for ${church.name}:`, emailErr);
            }
          }

          // Auto-enroll in drip sequence if configured
          if (config.auto_enroll_sequence_id && church.contact_email) {
            const firstStep = await DripStep.findOne({
              where: { sequence_id: config.auto_enroll_sequence_id },
              order: [['step_order', 'ASC']],
            });

            if (firstStep) {
              const nextStepAt = new Date();
              nextStepAt.setDate(nextStepAt.getDate() + firstStep.delay_days);

              await DripEnrollment.create({
                church_id: church.id,
                sequence_id: config.auto_enroll_sequence_id,
                current_step: 0,
                status: 'active',
                next_step_at: nextStepAt,
                enrolled_at: new Date(),
              });

              stats.enrolled++;
            }
          }
        } catch (importErr) {
          console.warn(`[Auto-Discovery] Error importing ${place.name}:`, importErr);
          stats.errors++;
        }
      }
    }
  } catch (searchErr) {
    console.error('[Auto-Discovery] Search error:', searchErr);
    stats.errors++;
  }

  emit('complete', `Complete: ${stats.discovered} discovered, ${stats.imported} imported, ${stats.enrolled} enrolled, ${stats.errors} errors`);
  console.log(`[Auto-Discovery] Complete: ${stats.discovered} discovered, ${stats.imported} imported, ${stats.enrolled} enrolled, ${stats.errors} errors`);
  return stats;
}

// ---------------------------------------------------------------------------
// Scheduler initialization
// ---------------------------------------------------------------------------

export function initAutoDiscoveryScheduler(): void {
  if (initialized || globalThis.__autoDiscoverySchedulerReady) {
    return;
  }

  // Run every hour, check if it's the configured hour
  cron.schedule('0 * * * *', async () => {
    try {
      const config = await getAutoDiscoveryConfig();
      if (!config.enabled) return;

      const currentHourUTC = new Date().getUTCHours();
      if (currentHourUTC !== config.run_at_hour_utc) return;

      console.log('[Auto-Discovery] Starting scheduled run...');
      await runAutoDiscovery();
    } catch (err) {
      console.error('[Auto-Discovery] Scheduled run error:', err);
    }
  });

  initialized = true;
  globalThis.__autoDiscoverySchedulerReady = true;
  console.log('[Auto-Discovery] Scheduler initialized');
}

// Extend globalThis
declare global {
  // eslint-disable-next-line no-var
  var __autoDiscoverySchedulerReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initAutoDiscoveryScheduler: (() => void) | undefined;
}

globalThis.__initAutoDiscoveryScheduler = initAutoDiscoveryScheduler;
