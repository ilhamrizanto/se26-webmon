import urllib.request, re
url = 'https://docs.google.com/spreadsheets/d/1a0t9gkPRg7DfDOXg2Rrl95byK8bKrfiikMfObgRfjBY/edit'
try:
    html = urllib.request.urlopen(url).read().decode('utf-8')
    names = re.findall(r'"name":"([^"]+)"', html)
    print("Sheets:", set(names))
except Exception as e:
    print(e)
