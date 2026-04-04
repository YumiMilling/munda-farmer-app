import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://aiipepmjqmytcenrxeit.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_guKK-leVl6bK-N0o13HcKw_m_oKZvua'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
