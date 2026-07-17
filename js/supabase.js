// supabase.js — cloud backup/restore using Supabase's REST API directly (no SDK needed)
const Cloud = {
  async getConfig() {
    const url = await DB.getSetting("supabase_url", "");
    const key = await DB.getSetting("supabase_anon_key", "");
    const backupId = await DB.getSetting("backup_id", "");
    return { url, key, backupId };
  },

  async saveConfig({ url, key, backupId }) {
    await DB.setSetting("supabase_url", url.trim().replace(/\/+$/, ""));
    await DB.setSetting("supabase_anon_key", key.trim());
    await DB.setSetting("backup_id", backupId.trim());
  },

  async backupNow() {
    const { url, key, backupId } = await this.getConfig();
    if (!url || !key || !backupId) {
      throw new Error("Add your Supabase URL, anon key and a backup ID in Settings first.");
    }
    const data = await DB.exportAll();
    const res = await fetch(`${url}/rest/v1/backups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: backupId, data, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backup failed (${res.status}): ${text || res.statusText}`);
    }
    await DB.setSetting("last_backup_at", new Date().toISOString());
    return true;
  },

  async restoreLatest() {
    const { url, key, backupId } = await this.getConfig();
    if (!url || !key || !backupId) {
      throw new Error("Add your Supabase URL, anon key and a backup ID in Settings first.");
    }
    const res = await fetch(
      `${url}/rest/v1/backups?id=eq.${encodeURIComponent(backupId)}&select=data,updated_at`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Restore failed (${res.status}): ${text || res.statusText}`);
    }
    const rows = await res.json();
    if (!rows || !rows.length) {
      throw new Error("No backup found for this backup ID yet.");
    }
    await DB.importAll(rows[0].data);
    return rows[0].updated_at;
  },
};
