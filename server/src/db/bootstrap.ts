import { client } from './index';

export async function ensureTablesExist() {
  try {
    // 1. Enums
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
          CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'pending', 'overdue', 'cancelled');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_transaction_status') THEN
          CREATE TYPE deposit_transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_la_expense_status') THEN
          CREATE TYPE custom_la_expense_status AS ENUM ('pending', 'paid', 'cancelled');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_request_service_type') THEN
          CREATE TYPE agent_request_service_type AS ENUM ('hotel', 'transportation', 'muthowif', 'visa', 'siskopatuh', 'custom_la');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_request_status') THEN
          CREATE TYPE agent_request_status AS ENUM ('draft', 'submitted', 'need_more_info', 'in_review', 'quoted', 'quote_revision_requested', 'quote_accepted', 'invoiced', 'payment_uploaded', 'paid', 'voucher_issued', 'completed', 'cancelled', 'rejected');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'muthowif_booking_event') THEN
          CREATE TYPE muthowif_booking_event AS ENUM ('Umrah', 'Makkah City Tour', 'Madinah City Tour');
        END IF;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'muthowif_booking_status') THEN
          CREATE TYPE muthowif_booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
        END IF;
      END $$;
    `;

    // 2. manual_invoices
    await client`
      CREATE TABLE IF NOT EXISTS manual_invoices (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255),
        client_phone VARCHAR(50),
        client_address TEXT,
        title VARCHAR(255),
        amount NUMERIC(10, 2) NOT NULL,
        paid_amount NUMERIC(10, 2) NOT NULL DEFAULT '0',
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        issue_date TIMESTAMP NOT NULL DEFAULT NOW(),
        due_date TIMESTAMP NOT NULL,
        status invoice_status NOT NULL DEFAULT 'draft',
        items JSONB NOT NULL,
        notes TEXT,
        pdf_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 3. custom_la_expenses
    await client`
      CREATE TABLE IF NOT EXISTS custom_la_expenses (
        id SERIAL PRIMARY KEY,
        custom_la_request_id INTEGER NOT NULL REFERENCES custom_la_requests(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        supplier_name VARCHAR(255) NOT NULL,
        description TEXT,
        amount NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        payment_date TIMESTAMP,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        notes TEXT,
        status custom_la_expense_status NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 4. agent_requests and agent_request_invoices
    await client`
      CREATE TABLE IF NOT EXISTS agent_company_profiles (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        company_phone VARCHAR(50),
        company_email VARCHAR(255),
        company_address TEXT,
        city VARCHAR(100),
        province VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Indonesia',
        logo_url TEXT,
        license_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS agent_requests (
        id SERIAL PRIMARY KEY,
        request_number VARCHAR(50) NOT NULL UNIQUE,
        agent_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        service_type agent_request_service_type NOT NULL,
        status agent_request_status NOT NULL DEFAULT 'draft',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        meta JSONB,
        quotation_data JSONB,
        quotation_notes TEXT,
        agent_quotation_response TEXT,
        total_amount NUMERIC(10, 2),
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        linked_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        linked_transport_id INTEGER REFERENCES transportation_bookings(id) ON DELETE SET NULL,
        linked_service_order_id INTEGER REFERENCES service_orders(id) ON DELETE SET NULL,
        linked_muthowif_booking_id INTEGER,
        linked_custom_la_id INTEGER REFERENCES custom_la_requests(id) ON DELETE SET NULL,
        assigned_admin_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        payment_proof_url TEXT,
        payment_proof_uploaded_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS agent_request_invoices (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        agent_request_id INTEGER NOT NULL REFERENCES agent_requests(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        paid_amount NUMERIC(10, 2) NOT NULL DEFAULT '0',
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        issue_date TIMESTAMP NOT NULL,
        due_date TIMESTAMP NOT NULL,
        status invoice_status NOT NULL DEFAULT 'draft',
        pdf_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS agent_request_timeline (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES agent_requests(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        actor_role VARCHAR(20) NOT NULL,
        meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        request_id INTEGER REFERENCES agent_requests(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 5. muthowif tables
    await client`
      CREATE TABLE IF NOT EXISTS muthowif_bookings (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        guest_name VARCHAR(255) NOT NULL,
        date_time TIMESTAMP NOT NULL,
        events JSONB NOT NULL,
        total_pax INTEGER NOT NULL,
        meeting_point VARCHAR(255) NOT NULL,
        status muthowif_booking_status NOT NULL DEFAULT 'pending',
        total_amount NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        assigned_muthowif_id INTEGER REFERENCES muthowifs(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS muthowif_invoices (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        muthowif_booking_id INTEGER NOT NULL REFERENCES muthowif_bookings(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        paid_amount NUMERIC(10, 2) NOT NULL DEFAULT '0',
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        issue_date TIMESTAMP NOT NULL,
        due_date TIMESTAMP NOT NULL,
        status invoice_status NOT NULL DEFAULT 'draft',
        pdf_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS muthowif_invoice_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES muthowif_invoices(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        method VARCHAR(50),
        reference_number VARCHAR(100),
        paid_at TIMESTAMP NOT NULL,
        status deposit_transaction_status NOT NULL DEFAULT 'completed',
        meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS muthowif_receipts (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        muthowif_booking_id INTEGER NOT NULL REFERENCES muthowif_bookings(id) ON DELETE CASCADE,
        muthowif_invoice_id INTEGER REFERENCES muthowif_invoices(id) ON DELETE SET NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        paid_amount NUMERIC(10, 2) NOT NULL,
        balance_due NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
        issue_date TIMESTAMP NOT NULL DEFAULT NOW(),
        payer_name VARCHAR(255) NOT NULL,
        payer_email VARCHAR(255),
        payer_phone VARCHAR(50),
        payer_address TEXT,
        bank_name VARCHAR(255),
        bank_country VARCHAR(100),
        account_name VARCHAR(255),
        account_number_or_iban VARCHAR(100),
        notes TEXT,
        amount_in_words TEXT,
        pdf_url TEXT,
        meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS muthowif_vouchers (
        id SERIAL PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        muthowif_booking_id INTEGER NOT NULL REFERENCES muthowif_bookings(id) ON DELETE CASCADE,
        issue_date TIMESTAMP NOT NULL DEFAULT NOW(),
        pdf_url TEXT,
        meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    console.log('[DB Bootstrap] Schema check & auto-sync verified successfully');
  } catch (err) {
    console.error('[DB Bootstrap] Warning: Schema auto-sync encountered an issue:', err);
  }
}
