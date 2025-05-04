// src/features/quickbooks/controller/quickbooksController.ts

import { NextFunction, Request, Response } from 'express';
import { generateConsentUrl, handleAuthCallback } from '../services/auth/quickbooksAuthService';
import createInvoiceService from '../services/invoice/createInvoice';
import supabase from '../supabase';
import { qboRequest } from '../utils/qboClient';

/**
 * Redirect merchant to Intuit’s consent screen
 */
export async function connectQuickBooks(req: Request, res: Response, next: NextFunction) {
  try {
    const state = Math.random().toString(36).substring(2);
    const url = generateConsentUrl(state);
    console.log('→ redirecting to Intuit:', url);
    res.redirect(url);
  } catch (err) {
    console.error('connectQuickBooks ERROR:', err);
    next(err);
  }
}

/**
 * Handle Intuit’s redirect back to your app:
 * store tokens, then confirm connection.
 */
export async function handleQuickBooksCallback(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('→ full callback URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const out = await handleAuthCallback(req.originalUrl);
    console.log('✅ tokens saved →', out);
    res.send('QuickBooks connected successfully!');
  } catch (err) {
    console.error('handleQuickBooksCallback RAW error:', err);
    console.error('keys:', Object.getOwnPropertyNames(err));
    res.status(500).json({
      message: (err as Error).message ?? '[no message]',
      stack:   (err as Error).stack   ?? '[no stack]',
      raw:     err
    });
  }
}

/**
 * Create an invoice
 */
export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await createInvoiceService(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

/**
 * Create a customer
 * POST /api/customers
 * body: { internalCustomerId, firstName, lastName, email }
 */
export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { internalCustomerId, firstName, lastName, email } = req.body;

    if (!internalCustomerId || !firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'internalCustomerId, firstName, lastName & email are required'
      });
    }

    // 1) Upsert the internal customer row
    const fullName = `${firstName} ${lastName}`;
    const { data: user, error: upsertErr } = await supabase
      .from('customers')
      .upsert(
        { id: internalCustomerId, name: fullName, email },
        { onConflict: 'id' }
      )
      .single();
    if (upsertErr) throw upsertErr;

    // 2) Create in QuickBooks
    const payload = {
      GivenName:       firstName,
      FamilyName:      lastName,
      DisplayName:     fullName,
      PrimaryEmailAddr:{ Address: email }
    };
    const { Customer: qboCustomer } = await qboRequest(
      '/customer?minorversion=65',
      { method: 'POST', body: JSON.stringify(payload) }
    );

    // 3) Save QBO customer ID back on your row
    const { error: updateErr } = await supabase
      .from('customers')
      .update({ qbo_customer_id: qboCustomer.Id })
      .eq('id', internalCustomerId);
    if (updateErr) throw updateErr;

    res.status(201).json({
      internalCustomerId,
      qboCustomerId: qboCustomer.Id,
      fullName
    });
  } catch (err) {
    next(err);
  }
}
