import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_ADDRESS = 'quotes@sunsetapp.us';
export const FROM_DISPLAY = 'Sunset Services <quotes@sunsetapp.us>';
