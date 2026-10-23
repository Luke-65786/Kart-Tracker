import { useId } from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { DEFAULT_PREFERENCES, THEMES } from "./lib/preferences.js";

function Toggle({ label, description, checked, onChange }) {
  const descriptionId = useId();
  return (
    <label className="setting-row toggle-row">
      <span className="setting-copy">
        <span className="setting-label">{label}</span>
        <span className="setting-description" id={descriptionId}>
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-describedby={descriptionId}
        checked={checked}
        onChange={onChange}
      />
      <span className="setting-switch" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

export default function SettingsPanel({ preferences, onChange, onClose }) {
  const update = (key, value) => onChange({ ...preferences, [key]: value });
  return (
    <div className="settings-panel">
      <p className="modal-description">
        Make this workspace feel like yours. Changes apply instantly and are
        saved on this device.
      </p>
      <fieldset className="settings-section theme-section">
        <legend>Choose your theme</legend>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <label className="theme-option" key={theme.id}>
              <input
                type="radio"
                name="theme"
                value={theme.id}
                aria-label={`${theme.name} theme`}
                checked={preferences.theme === theme.id}
                onChange={() => update("theme", theme.id)}
              />
              <span className="theme-card">
                <span
                  className="theme-preview"
                  data-preview-theme={theme.id}
                  aria-hidden="true"
                >
                  <span className="preview-sidebar">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="preview-main">
                    <span className="preview-title" />
                    <span className="preview-stats">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="preview-table">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                  <span className="theme-selected">
                    <Check size={13} strokeWidth={3} />
                  </span>
                </span>
                <span className="theme-name">{theme.name}</span>
                <span className="theme-description">{theme.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-section">
        <legend>Display</legend>
        <div className="scale-setting">
          <div className="setting-row">
            <div className="setting-copy">
              <label className="setting-label" htmlFor="ui-scale">
                UI scale
              </label>
              <span className="setting-description" id="scale-description">
                Adjust the size of text, buttons, and panels.
              </span>
            </div>
            <output className="scale-value" htmlFor="ui-scale">
              {preferences.scale}%
            </output>
          </div>
          <input
            id="ui-scale"
            aria-describedby="scale-description"
            className="scale-slider"
            type="range"
            min="80"
            max="125"
            step="5"
            value={preferences.scale}
            onChange={(e) => update("scale", Number(e.target.value))}
          />
          <div className="scale-labels">
            <span>Smaller · 80%</span>
            <button type="button" onClick={() => update("scale", 100)}>
              Default · 100%
            </button>
            <span>Larger · 125%</span>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-copy">
            <label className="setting-label" htmlFor="table-density">
              Table spacing
            </label>
            <span className="setting-description" id="density-description">
              Fit more karts and laps on screen.
            </span>
          </div>
          <span className="settings-select">
            <select
              id="table-density"
              aria-describedby="density-description"
              value={preferences.density}
              onChange={(e) => update("density", e.target.value)}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
            <ChevronDown size={14} />
          </span>
        </div>
        <Toggle
          label="Lap trends"
          description="Show mini lap charts in the desktop leaderboard."
          checked={preferences.showTrends}
          onChange={(e) => update("showTrends", e.target.checked)}
        />
        <div className="setting-row">
          <div className="setting-copy">
            <label className="setting-label" htmlFor="default-sort">
              Default leaderboard sort
            </label>
            <span className="setting-description" id="sort-description">
              Your preferred order when you open Kartlab.
            </span>
          </div>
          <span className="settings-select">
            <select
              id="default-sort"
              aria-describedby="sort-description"
              value={preferences.defaultSort}
              onChange={(e) => update("defaultSort", e.target.value)}
            >
              <option value="average">Average lap</option>
              <option value="best">Best lap</option>
              <option value="number">Kart number</option>
              <option value="laps">Lap count</option>
            </select>
            <ChevronDown size={14} />
          </span>
        </div>
      </fieldset>

      <fieldset className="settings-section">
        <legend>Accessibility</legend>
        <Toggle
          label="Reduce motion"
          description="Turn off interface animations. Your device’s reduced motion preference is always respected."
          checked={preferences.reduceMotion}
          onChange={(e) => update("reduceMotion", e.target.checked)}
        />
      </fieldset>
      <div className="settings-footer">
        <span>Resetting settings keeps your sessions and folders.</span>
        <div className="settings-footer-actions">
          <button
            className="button secondary"
            onClick={() => onChange({ ...DEFAULT_PREFERENCES })}
          >
            <RotateCcw size={14} />
            Reset settings
          </button>
          <button className="button primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
