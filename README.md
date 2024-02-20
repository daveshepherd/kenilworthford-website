# Kenilworth Ford

```
curl -s https://environment.data.gov.uk/flood-monitoring/id/measures/2627-level-stage-i-15_min-mASD/readings | jq -r '.items[] | "\(.dateTime),\(.value)"' > levels.csv
```


```
$ yarn
$ yarn watch
```

Build the production site

```
$ yarn build
```
