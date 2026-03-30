fake_tokens = {}

def create_token(username):
    token = f"token_{username}"
    fake_tokens[token] = username
    return token

def get_user(token):
    return fake_tokens.get(token)