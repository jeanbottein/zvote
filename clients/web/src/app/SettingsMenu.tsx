import { useState } from 'react';
import { usePreferences } from '../preferences/preferences';
import Dialog from '../ui/Dialog';
import { SettingsIcon } from '../ui/icons';
import SegmentedControl from '../ui/SegmentedControl';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [preferences, update] = usePreferences();

  return (
    <>
      <button type="button" className="icon-button" aria-label="Settings" onClick={() => setOpen(true)}>
        <SettingsIcon />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Settings">
        <div className="settings">
          <SegmentedControl
            legend="Appearance"
            name="theme"
            value={preferences.theme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'Automatic' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => update({ theme })}
          />
          <SegmentedControl
            legend="Mention colours"
            name="palette"
            value={preferences.colorblind ? 'grey' : 'colour'}
            options={[
              { value: 'colour', label: 'Green to red' },
              { value: 'grey', label: 'Shades of grey' },
            ]}
            onChange={(palette) => update({ colorblind: palette === 'grey' })}
            hint="Shades of grey read the same whatever colours you see: the lighter, the better."
          />
          <SegmentedControl
            legend="Majority judgment ballot"
            name="mjBallot"
            value={preferences.mjBallot}
            options={[
              { value: 'scale', label: 'Colour scale' },
              { value: 'dropdown', label: 'Dropdowns' },
            ]}
            onChange={(mjBallot) => update({ mjBallot })}
          />
          <SegmentedControl
            legend="Casting your ballot"
            name="submission"
            value={preferences.submission}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'envelope', label: 'Envelope' },
            ]}
            onChange={(submission) => update({ submission })}
            hint={preferences.submission === 'live'
              ? 'Every change counts the moment you make it.'
              : 'Fill in your ballot, then submit it in one go.'}
          />
        </div>
      </Dialog>
    </>
  );
}
