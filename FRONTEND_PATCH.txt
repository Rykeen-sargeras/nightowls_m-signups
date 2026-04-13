/* =============================================================
   UI.JS CHANGES — Show signup number (#N) next to player names
   =============================================================

   Find every place where player names are rendered and add the
   signup_number badge. Below are the specific changes needed.

   1. In the renderRoster() function, where player cards/rows are
      created, add the badge next to the username:

   BEFORE (something like):
      <span class="player-name" style="color:${classColor}">${p.username}</span>

   AFTER:
      <span class="signup-num">#${p.signup_number}</span>
      <span class="player-name" style="color:${classColor}">${p.username}</span>

   2. In renderSavedGroups() / renderGroupCards(), same change —
      add the #N badge wherever the player name appears in group views.

   3. Add this CSS to styles.css:
*/

/* --- ADD TO styles.css --- */

.signup-num {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    color: #ffd100;
    background: rgba(255, 209, 0, 0.15);
    border: 1px solid rgba(255, 209, 0, 0.3);
    border-radius: 4px;
    padding: 1px 5px;
    margin-right: 6px;
    font-family: monospace;
    min-width: 28px;
    text-align: center;
    vertical-align: middle;
}

/* Bench players get a dimmer badge */
.bench .signup-num {
    color: #888;
    background: rgba(136, 136, 136, 0.1);
    border-color: rgba(136, 136, 136, 0.2);
}
