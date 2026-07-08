import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ContactList from './pages/ContactList';
import ContactForm from './pages/ContactForm';
import ScanPage from './pages/ScanPage';
import VoiceEntryPage from './pages/VoiceEntryPage';
import GroupsPage from './pages/GroupsPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contacts" element={<ContactList />} />
        <Route path="/contacts/new" element={<ContactForm />} />
        <Route path="/contacts/:id/edit" element={<ContactForm />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/voice" element={<VoiceEntryPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
