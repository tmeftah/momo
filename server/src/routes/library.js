import { db } from '../db.js';
import { crud } from '../lib/crud.js';
import { eq, flag } from '../lib/util.js';

export default async function libraryRoutes(app) {
  // ---------- Connector library ----------
  crud(app, {
    path: '/connectors',
    table: 'connectors',
    view: 'v_connectors',
    fields: ['name', 'type', 'application', 'pins', 'wires', 'wiring', 'notes'],
    required: ['name'],
    numbers: ['pins'],
    json: ['wires'],
    search: ['name', 'type', 'application', 'wiring', 'notes', 'wires'],
    filters: { application: eq('application'), pins: eq('pins') },
    order: 'name COLLATE NOCASE',
    photoRef: 'connector',
    extend: (row) => {
      row.adaptations = db().prepare('SELECT * FROM v_adaptations WHERE connector_id = ? ORDER BY id DESC').all(row.id);
      return row;
    },
  });

  // ---------- Recorded adaptations (pinout + solution) ----------
  crud(app, {
    path: '/adaptations',
    table: 'adaptations',
    view: 'v_adaptations',
    fields: ['connector_id', 'repair_id', 'title', 'problem', 'pinout', 'solution', 'notes'],
    required: ['title'],
    search: ['title', 'problem', 'pinout', 'solution', 'notes', 'connector_name'],
    filters: { connector_id: eq('connector_id'), repair_id: eq('repair_id') },
    photoRef: 'adaptation',
  });

  // ---------- Personal troubleshooting knowledge base ----------
  crud(app, {
    path: '/solutions',
    table: 'solutions',
    view: 'v_solutions',
    fields: ['title', 'category', 'symptoms', 'diagnosis', 'cause', 'solution', 'parts', 'wiring', 'notes', 'favorite'],
    required: ['title'],
    numbers: ['favorite'],
    search: ['title', 'category', 'symptoms', 'diagnosis', 'cause', 'solution', 'parts', 'notes'],
    filters: { category: eq('category'), favorite: flag('favorite = 1') },
    order: 'favorite DESC, COALESCE(updated_at, created_at) DESC',
    photoRef: 'solution',
  });
}
