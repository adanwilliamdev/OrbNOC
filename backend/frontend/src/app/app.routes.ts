import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DevicesComponent } from './components/devices/devices.component';
import { IncidentsComponent } from './components/incidents/incidents.component';
import { TopologyComponent } from './components/topology/topology.component';
import { ToolsComponent } from './components/tools/tools.component';
import { AuditComponent } from './components/audit/audit.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'topology', component: TopologyComponent },
  { path: 'devices', component: DevicesComponent },
  { path: 'incidents', component: IncidentsComponent },
  { path: 'tools', component: ToolsComponent },
  { path: 'audit', component: AuditComponent }
];