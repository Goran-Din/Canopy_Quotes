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
  Img,
} from '@react-email/components';

export interface ProposalEmailProps {
  customerName: string;
  propertyAddress: string;
  quoteNumber: string;
  salespersonName: string;
  salespersonEmail: string;
  salespersonPhone: string | null;
  totalAmount: string;       // Pre-formatted: '$2,470.00'
  billingType: string;       // 'Monthly Fixed' / 'Per Push' etc.
  validUntil: string;        // 'March 29, 2026'
  serviceType: string;       // 'Landscaping Maintenance' / 'Snow Removal'
  tenantLogoUrl: string | null;
  tenantPrimaryColor: string;
}

export function ProposalEmailTemplate({
  customerName,
  propertyAddress,
  quoteNumber,
  salespersonName,
  salespersonEmail,
  salespersonPhone,
  totalAmount,
  billingType,
  validUntil,
  serviceType,
  tenantLogoUrl,
  tenantPrimaryColor,
}: ProposalEmailProps) {
  const color = tenantPrimaryColor || '#2E75B6';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: '#f4f4f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>

          {/* Header bar */}
          <Section style={{ backgroundColor: color, padding: '24px 32px' }}>
            {tenantLogoUrl ? (
              <Img src={tenantLogoUrl} alt="Sunset Services" height="48" style={{ display: 'block' }} />
            ) : (
              <Heading style={{ color: '#ffffff', margin: 0, fontSize: '22px', fontWeight: 'bold' }}>
                Sunset Services
              </Heading>
            )}
          </Section>

          {/* Main content */}
          <Section style={{ padding: '32px' }}>
            <Heading style={{ fontSize: '20px', color: '#1F3864', marginTop: 0 }}>
              Service Proposal #{quoteNumber}
            </Heading>

            <Text style={{ fontSize: '16px', color: '#333', marginBottom: '4px' }}>
              Dear {customerName},
            </Text>

            <Text style={{ color: '#444', lineHeight: '1.6' }}>
              Please find attached our proposal for {serviceType.toLowerCase()} services
              at {propertyAddress}.
            </Text>

            {/* Proposal summary box */}
            <Section style={{
              border: `2px solid ${color}`,
              borderRadius: '6px',
              padding: '20px 24px',
              margin: '24px 0',
              backgroundColor: '#f8f9fa',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666', fontSize: '14px' }}>Proposal</td>
                    <td style={{ padding: '6px 0', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>{quoteNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666', fontSize: '14px' }}>Total</td>
                    <td style={{ padding: '6px 0', fontWeight: 'bold', textAlign: 'right', fontSize: '18px', color: color }}>{totalAmount}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666', fontSize: '14px' }}>Billing</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '14px' }}>{billingType}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666', fontSize: '14px' }}>Valid Until</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '14px' }}>{validUntil}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Text style={{ color: '#444', lineHeight: '1.6' }}>
              The full proposal is attached as a PDF. To accept, please sign and return
              the proposal or reply to this email.
            </Text>

            <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0' }} />

            {/* Salesperson contact */}
            <Text style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>
              <strong>Questions? Contact your representative:</strong>
            </Text>
            <Text style={{ fontSize: '14px', color: '#444', lineHeight: '1.8', marginTop: '4px' }}>
              {salespersonName}<br />
              <a href={`mailto:${salespersonEmail}`} style={{ color: color }}>{salespersonEmail}</a>
              {salespersonPhone ? <><br />{salespersonPhone}</> : null}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{
            backgroundColor: '#f4f4f4',
            padding: '16px 32px',
            borderTop: `3px solid ${color}`,
          }}>
            <Text style={{ fontSize: '12px', color: '#888', margin: 0, textAlign: 'center' }}>
              Sunset Services US | Aurora, IL | quotes@sunsetapp.us
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default ProposalEmailTemplate;
