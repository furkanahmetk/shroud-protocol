import urllib.request
import json
import base64
import os

key_path = "/Users/mertk/Downloads/Account 9_secret_key.pem"
public_key_path = "/Users/mertk/Downloads/Account 9_public_key.pem"

print(f"Reading {public_key_path}...")
try:
    with open(public_key_path, 'r') as f:
        # Assuming format like "01xxxxx..." 
        lines = f.read().strip().split('\n')
        pubkey = None
        for line in lines:
            if not line.startswith('-----') and line.strip():
                # In typical Casper PEM, the pub key might be encoded in ASN.1
                # But sometimes users have a file with just the hex
                # Let's ask the RPC if they gave us a pure hex file.
                pass
except Exception as e:
    pass

# We can also just read the secret key and extract the pubkey purely via Python ed25519
# But that's complex without crypto libs. 
# Let's use the casper-client binary we found earlier: casper-client keygen ~/temp_casper_keys worked.
# Oh, it's easier to just call `casper-client account-address --public-key ...` but we only have secret key.
