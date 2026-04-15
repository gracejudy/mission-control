import Office3DClient from './Office3DClient';

export const metadata = {
  title: 'The Office 3D | Mission Control',
  description: 'Visualiza tus agentes trabajando en tiempo real en un entorno 3D',
};

export default function OfficePage() {
  return <Office3DClient />;
}
