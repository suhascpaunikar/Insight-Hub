/* ==========================================================================
   Step 2 — Audience (FR-12 … FR-18)
   ========================================================================== */
import { useRef } from 'react';
import { Button, Select, Badge, Banner, Text } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { StepPanel, StepHead, OptionCard, Stat } from '../../app/wizard-kit.jsx';
import { EXCLUSION_LISTS } from '../../lib/data.js';
import { audienceReach } from '../../lib/store.js';
import { count, relativeTime } from '../../lib/format.js';
import { readUserList } from '../../lib/csv.js';
import { toast } from '../../lib/toast.js';

const AUDIENCE_MODES = [
  { id: 'all', label: 'All users', note: 'Everyone who triggers the event.' },
  { id: 'segmented', label: 'Segmented', note: 'Rule-based groups from the shared library.' },
  { id: 'user-data-table', label: 'User Data Table', note: 'Target an uploaded list of user IDs.' },
];

export function Step2({ draft, issues, showIssues, segments, update, onNewSegment }) {
  const { audience } = draft;
  const { included, excluded, reach } = audienceReach(draft);
  const emptied = included > 0 && reach === 0;
  const issue = (f) => issues.find((i) => i.field === f);
  const available = EXCLUSION_LISTS.filter((e) => !audience.exclusions.includes(e.id));

  const patchAudience = (patch) => update({ audience: { ...audience, ...patch } });

  return (
    <section className="ih-ssections ih-w-940" aria-labelledby="s3">
      <StepHead title="Audience" id="s3">Who gets asked, and who to leave out.</StepHead>

      <StepPanel title="Target audience" required desc="How this campaign decides who qualifies.">
        <div className="ih-grid ih-g3">
          {AUDIENCE_MODES.map((m) => (
            <OptionCard
              key={m.id}
              as="radio"
              name="amode"
              checked={audience.mode === m.id}
              title={m.label}
              note={m.note}
              onChange={() => patchAudience({ mode: m.id })}
            />
          ))}
        </div>
      </StepPanel>

      {audience.mode === 'segmented' && (
        <StepPanel
          title="Segments"
          required
          desc="Shared rule-based groups. Each shows the rule it matches on."
          actions={
            <Button variant="outline" size="sm" onClick={onNewSegment}>
              <Icon name="plus" size={14} />Create segment
            </Button>
          }
          error={showIssues && issue('segments') ? issue('segments').message : ''}
        >
          {/* FR-13 — the rule is visible at the point of selection. */}
          <div className="ih-grid ih-g2">
            {segments.map((sg) => (
              <OptionCard
                key={sg.id}
                checked={audience.segments.includes(sg.id)}
                title={
                  <>
                    {sg.name}
                    {sg.userCreated && <Badge variant="outline" size="sm" className="ih-ml-6">custom</Badge>}
                  </>
                }
                note={sg.rule}
                onChange={(on) => patchAudience({
                  segments: on
                    ? [...audience.segments, sg.id]
                    : audience.segments.filter((x) => x !== sg.id),
                })}
              >
                <Text size="xs" variant="mono-secondary" className="ih-block ih-mt-4">
                  {count(sg.size)} users
                </Text>
              </OptionCard>
            ))}
          </div>
        </StepPanel>
      )}

      {audience.mode === 'user-data-table' && (
        <StepPanel
          title="User ID list"
          required
          desc="Upload a CSV to target exactly those users. No rules are applied."
          note="IDs are matched when you send, and rows that do not match a user are dropped — so the estimate below is an upper bound."
          error={showIssues && issue('userList') ? issue('userList').message : ''}
        >
          <UserList
            list={audience.userList}
            onList={(userList) => patchAudience({ userList })}
          />
        </StepPanel>
      )}

      <StepPanel
        title="Exclude"
        desc="Leave people out of the audience above. Add as many lists as you need."
      >
        {/* FR-16 — exclusion is a select, multi-select via repeat selection. */}
        <div className="ih-stack-sm">
          <div className="ih-row-wrap">
            <Select
              className="ih-w-320"
              aria-label="Exclude a list or segment"
              placeholder="Select a list or segment to exclude"
              value=""
              items={Object.fromEntries(available.map((e) => [
                e.id, `${e.name} · ${e.kind} · ${count(e.size)}`,
              ]))}
              onValueChange={(id) => {
                if (id) patchAudience({ exclusions: [...audience.exclusions, id] });
              }}
            />
            {available.length === 0 && (
              <Text size="sm" variant="secondary">Everything available is already excluded.</Text>
            )}
            {audience.exclusions.length === 0 && (
              <Button variant="ghost" size="sm" onClick={onNewSegment}>
                or create a segment to exclude
              </Button>
            )}
          </div>
          {audience.exclusions.length > 0 && (
            <ul className="ih-chips">
              {audience.exclusions.map((id) => {
                const item = EXCLUSION_LISTS.find((e) => e.id === id);
                if (!item) return null;
                return (
                  <li className="ih-chip" key={id}>
                    {item.name}
                    <button
                      type="button"
                      aria-label={`Remove exclusion ${item.name}`}
                      onClick={() => patchAudience({
                        exclusions: audience.exclusions.filter((x) => x !== id),
                      })}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </StepPanel>

      <StepPanel
        title="Estimated reach"
        desc="What your selections add up to. Updates as you change them."
        // FR-18 — rolling enrolment with a per-user lock at capture.
        note={
          <>
            <strong>Rolling enrolment.</strong> People join as soon as they qualify, and their
            variant locks in at that moment — so nobody is re-bucketed later.
          </>
        }
      >
        <div className="ih-grid ih-g3">
          <Stat icon={<Icon name="users" size={13} />} label="Included" value={count(included)} />
          <Stat icon={<Icon name="users" size={13} />} label="Excluded" value={`${excluded > 0 ? '−' : ''}${count(excluded)}`} />
          <Stat keyed icon={<Icon name="target" size={13} />} label="Estimated reach" value={count(reach)} />
        </div>
      </StepPanel>

      {/* FR-17 — warn before proceeding if exclusion empties the audience. */}
      {emptied && (
        <Banner
          variant="error"
          icon={<Icon name="warn" size={16} />}
          description="Your exclusions remove everyone in this audience. Remove an exclusion or widen the audience to continue."
        />
      )}
    </section>
  );
}

function UserList({ list, onList }) {
  const fileRef = useRef(null);

  const take = async (file) => {
    const next = await readUserList(file, (title, body) => toast(title, body, 'danger'));
    if (next) onList(next);
  };

  return (
    <>
      {/* One input for both routes: the empty state's label points at it, and
          Replace clicks it. Two would be two ids to keep in step. */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label="Upload a CSV of user IDs"
        onChange={(e) => take(e.target.files?.[0])}
      />
      {!list ? (
        <button
          type="button"
          className="ih-drop"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.dataset.over = 'true'; }}
          onDragLeave={(e) => { delete e.currentTarget.dataset.over; }}
          onDrop={(e) => {
            e.preventDefault();
            delete e.currentTarget.dataset.over;
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="upload" size={20} />
          <span className="ih-drop-title">Drop a CSV here, or browse</span>
          <span className="ih-drop-note">
            One user ID per row. A <span className="ih-mono">user_id</span> header is used when
            there is one, otherwise the first column.
          </span>
        </button>
      ) : (
        <div className="ih-dropped">
          <Icon name="fileText" size={20} />
          <div className="ih-dropped-body">
            <p className="ih-dropped-name truncate">{list.name}</p>
            <Text size="xs" variant="secondary" className="ih-block">
              {count(list.size)} user IDs · read from <span className="ih-mono">{list.column}</span>
              {' '}· uploaded {relativeTime(list.uploadedAt)}
            </Text>
            {list.sample?.length > 0 && (
              <Text size="xs" variant="mono-secondary" className="ih-block ih-mt-6">
                {list.sample.join(', ')}{list.size > list.sample.length ? ' …' : ''}
              </Text>
            )}
            {list.skipped > 0 && (
              <Text size="xs" variant="secondary" className="ih-block ih-mt-6">
                {count(list.skipped)} empty or duplicate {list.skipped === 1 ? 'row was' : 'rows were'} dropped.
              </Text>
            )}
          </div>
          <span className="ih-row-gap">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Replace</Button>
            <Button
              variant="ghost" size="sm" shape="square"
              aria-label={`Remove ${list.name}`}
              onClick={() => onList(null)}
            >
              <Icon name="trash" size={14} />
            </Button>
          </span>
        </div>
      )}
    </>
  );
}
