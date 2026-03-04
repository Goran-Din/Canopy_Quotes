// @ts-expect-error react-jsx transform handles React import
import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
} from '@react-email/components';

export interface StatusAlertEmailProps {
  salespersonName: string;
  quoteNumber: string;
  customerName: string;
  newStatus: 'approved' | 'rejected';
  changedByName: string;
  totalAmount: string;
  dashboardUrl: string;
  tenantPrimaryColor: string;
}

export function StatusAlertEmailTemplate({
  salespersonName,
  quoteNumber,
  customerName,
  newStatus,
  changedByName,
  totalAmount,
  dashboardUrl,
  tenantPrimaryColor,
}: StatusAlertEmailProps) {
  const color = tenantPrimaryColor || '#2E75B6';
  const isApproved = newStatus === 'approved';
  const statusEmoji = isApproved ? '✅' : '❌';
  const statusLabel = isApproved ? 'Approved' : 'Rejected';
  const statusColor = isApproved ? '#2e7d32' : '#c62828';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: '#f4f4f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>

          {/* Header */}
          <Section style={{ backgroundColor: color, padding: '20px 32px' }}>
            <Heading style={{ color: '#ffffff', margin: 0, fontSize: '18px' }}>
              Canopy Quotes — Quote Status Update
            </Heading>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <Text style={{ fontSize: '16px', color: '#333' }}>Hi {salespersonName},</Text>

            <Text style={{ fontSize: '16px', color: '#444', lineHeight: '1.6' }}>
              Quote <strong>{quoteNumber}</strong> for <strong>{customerName}</strong> has been
              marked as{' '}
              <span style={{ color: statusColor, fontWeight: 'bold' }}>
                {statusEmoji} {statusLabel}
              </span>{' '}
              by {changedByName}.
            </Text>

            {/* Summary box */}
            <Section style={{
              border: `2px solid ${statusColor}`,
              borderRadius: '6px',
              padding: '16px 20px',
              margin: '20px 0',
              backgroundColor: isApproved ? '#f1f8f1' : '#fdf3f3',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#555', fontSize: '14px' }}>Quote</td>
                    <td style={{ padding: '4px 0', fontWeight: 'bold', textAlign: 'right' }}>{quoteNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#555', fontSize: '14px' }}>Client</td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>{customerName}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#555', fontSize: '14px' }}>Total</td>
                    <td style={{ padding: '4px 0', fontWeight: 'bold', textAlign: 'right' }}>{totalAmount}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#555', fontSize: '14px' }}>Status</td>
                    <td style={{ padding: '4px 0', fontWeight: 'bold', color: statusColor, textAlign: 'right' }}>
                      {statusEmoji} {statusLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {isApproved && (
              <Text style={{ color: '#2e7d32', lineHeight: '1.6' }}>
                🎉 Great work! The next step is to convert this quote to a job in Canopy CRM.
              </Text>
            )}

            <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />

            <Text style={{ fontSize: '13px', color: '#888' }}>
              View this quote in your dashboard:{' '}
              <a href={dashboardUrl} style={{ color: color }}>{dashboardUrl}</a>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#f4f4f4', padding: '14px 32px', borderTop: `3px solid ${color}` }}>
            <Text style={{ fontSize: '12px', color: '#888', margin: 0, textAlign: 'center' }}>
              Canopy Quotes | Sunset Services US | quotes@sunsetapp.us
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default StatusAlertEmailTemplate;
