/* ==========================================================================
   PhonePreview.jsx — the campaign as it lands on a device (FR-50 / FR-54).

   One of §11.4's "(none)" entries and plainly product-specific: a phone
   bezel around the configured questions. What Kumo supplies inside it is the
   Badge on each choice letter and the Button shapes.

   Interactive in the Schedule step: tapping a rating walks the branch that
   answer leads to, so the branching configured two steps earlier can be read
   rather than trusted.
   ========================================================================== */
import { Badge, Button, Text } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { templateOf, variantScaleMax } from '../lib/store.js';
import { BAND_LABEL } from '../lib/palette.js';

// scale comes from the store, so the preview and the validator agree

export function PhonePreview({ variant, interactive = false, picked = null, onRate }) {
  const template = templateOf(variant);
  if (!template) {
    return (
      <div className="ih-phone">
        <div className="ih-phone-notch" />
        <div className="ih-phone-screen ih-phone-empty">
          <Text size="xs" variant="secondary">
            Pick a template to see the configured content on device.
          </Text>
        </div>
      </div>
    );
  }

  const max = variantScaleMax(variant);
  const supports = template.supports;
  const showRating = supports.includes('nps') || supports.includes('star');
  const branchingOn = variant.ratingElement === 'star' ? true : variant.branchingEnabled;
  const band = picked == null ? null
    : max === 10 ? (picked <= 3 ? 'detractor' : picked <= 7 ? 'passive' : 'promoter')
    : (picked <= 2 ? 'detractor' : picked === 3 ? 'passive' : 'promoter');
  const followUp = branchingOn && band ? variant.branches[band] : variant.branches.passive;

  const rate = (value) => { if (interactive) onRate?.(value); };

  return (
    <div className="ih-phone">
      <div className="ih-phone-notch" />
      <div className="ih-phone-screen">
        <div className="ih-row-between">
          <Text size="xs" variant="mono-secondary">{template.name} · {variant.channel}</Text>
          <Icon name="x" size={12} />
        </div>

        {supports.includes('image') && variant.elements.some((e) => e.type === 'image') && (
          <div className="ih-dv ih-dv-img" />
        )}

        {showRating && (
          <div>
            <p className="ih-phone-q">{variant.ratingQuestion}</p>
            <div className="ih-rate-row">
              {variant.ratingElement === 'star'
                ? Array.from({ length: 5 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`ih-star-btn${picked && picked >= i + 1 ? ' ih-on' : ''}`}
                      disabled={!interactive}
                      aria-label={`${i + 1} stars`}
                      onClick={() => rate(i + 1)}
                    >★</button>
                  ))
                : Array.from({ length: max }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`ih-rate-btn${picked === i + 1 ? ' ih-on' : ''}`}
                      disabled={!interactive}
                      onClick={() => rate(i + 1)}
                    >{i + 1}</button>
                  ))}
            </div>
            {picked && (
              <Text size="xs" variant="secondary" className="ih-block ih-mt-6">
                You chose <span className="ih-mono">{picked}</span> — {BAND_LABEL[band]} band
              </Text>
            )}
          </div>
        )}

        {(picked || !showRating) && (
          <div>
            <p className="ih-phone-q">{followUp.question || 'Type here'}</p>
            <div className="ih-stack-sm ih-mt-6">
              {followUp.choices.map((c, i) => (
                <div className="ih-opt ih-opt-tight" key={c.id || i}>
                  <Badge variant="outline" size="sm" className="ih-choice-letter">
                    {String.fromCharCode(65 + i)}
                  </Badge>
                  <Text size="xs">{c.text}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {(picked || !showRating) && supports.includes('text') && (
          <div>
            <p className="ih-phone-q">{variant.openTextQuestion}</p>
            <div className="ih-dv ih-dv-field" />
          </div>
        )}

        {variant.elements.filter((e) => e.type === 'mcq').map((e) => (
          <div key={e.id}>
            <p className="ih-phone-q">{e.label}</p>
            <div className="ih-stack-sm ih-mt-6">
              {(e.choices || []).map((c, i) => (
                <div className="ih-opt ih-opt-tight" key={c.id || i}>
                  <Badge variant="outline" size="sm" className="ih-choice-letter">
                    {String.fromCharCode(65 + i)}
                  </Badge>
                  <Text size="xs">{c.text}</Text>
                </div>
              ))}
            </div>
          </div>
        ))}

        {variant.elements.some((e) => e.type === 'thumbs') && (
          <div className="ih-row-gap">
            <Button variant="outline" size="sm"><Icon name="thumbs" size={13} />Yes</Button>
            <Button variant="outline" size="sm" className="ih-flip"><Icon name="thumbs" size={13} /></Button>
          </div>
        )}

        <Button variant="primary" size="sm" className="ih-phone-submit">Submit</Button>
      </div>
    </div>
  );
}
