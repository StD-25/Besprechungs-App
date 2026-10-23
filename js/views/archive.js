import * as model from '../model.js';
import { app, setHeader, setActiveTab } from '../core/ui.js';
import { reportCards, bindReportCards } from './home.js';

export async function render() {
  setHeader('Archiv');
  setActiveTab('archive');
  const reports = await model.listReports('archived');
  app().innerHTML = `<h2>Archivierte Berichte</h2>${await reportCards(reports)}`;
  bindReportCards(app());
}
