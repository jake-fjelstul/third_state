import readline from 'node:readline'
import { Writable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'

function askPassword(promptText) {
  return new Promise((resolve) => {
    const mutableOutput = new Writable({
      write(chunk, encoding, callback) {
        if (!this.muted) {
          process.stdout.write(chunk, encoding)
        }
        callback()
      },
    })
    mutableOutput.muted = false

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableOutput,
      terminal: true,
    })

    process.stdout.write(promptText)
    mutableOutput.muted = true

    rl.question('', (password) => {
      rl.close()
      process.stdout.write('\n')
      resolve(password)
    })
  })
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const targetEmail = process.env.TARGET_EMAIL

  if (!supabaseUrl) {
    console.error('Error: SUPABASE_URL (or VITE_SUPABASE_URL) environment variable is missing.')
    console.error('Usage: TARGET_EMAIL="user@example.com" node --env-file=.env.local scripts/set-admin-password.mjs')
    process.exit(1)
  }

  if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.')
    console.error('Usage: TARGET_EMAIL="user@example.com" node --env-file=.env.local scripts/set-admin-password.mjs')
    process.exit(1)
  }

  if (!targetEmail) {
    console.error('Error: TARGET_EMAIL environment variable is missing.')
    console.error('Usage: TARGET_EMAIL="user@example.com" node --env-file=.env.local scripts/set-admin-password.mjs')
    process.exit(1)
  }

  const password = await askPassword('Enter new password: ')
  if (!password || password.length < 12) {
    console.error('Error: Password must be at least 12 characters.')
    process.exit(1)
  }

  const confirmPassword = await askPassword('Confirm new password: ')
  if (password !== confirmPassword) {
    console.error('Error: Passwords do not match.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error(`Error listing users: ${listError.message}`)
    process.exit(1)
  }

  const targetUser = usersData.users.find(
    (u) => u.email && u.email.toLowerCase() === targetEmail.trim().toLowerCase()
  )

  if (!targetUser) {
    console.error('Error: User not found.')
    process.exit(1)
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
    password,
  })

  if (updateError) {
    console.error(`Error updating user password: ${updateError.message}`)
    process.exit(1)
  }

  console.log(`${targetUser.id}: Password set`)
}

main().catch((err) => {
  console.error(`Unexpected error: ${err?.message || err}`)
  process.exit(1)
})
