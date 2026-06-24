import json

with open('captured_api_responses.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for url, val in data.items():
    print(f"URL: {url}")
    print(f"  Type: {type(val)}")
    if isinstance(val, dict):
        print(f"  Keys: {list(val.keys())}")
        if 'data' in val:
            print(f"    val['data'] type: {type(val['data'])}")
            if isinstance(val['data'], dict):
                print(f"    val['data'] keys: {list(val['data'].keys())}")
            elif isinstance(val['data'], list):
                print(f"    val['data'] length: {len(val['data'])}")
    elif isinstance(val, list):
        print(f"  Length: {len(val)}")
        if len(val) > 0:
            print(f"  First item type: {type(val[0])}")
            if isinstance(val[0], dict):
                print(f"  First item keys: {list(val[0].keys())}")
    print("-" * 50)
